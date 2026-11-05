package router

import (
	"context"
	"errors"
	"fmt"
	"io"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/utils"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

type Browse struct{}

const defaultMaxUploadBytes = 5 << 30

// maxUploadBytes caps the request body of an upload; LoadUploadLimit sets it at startup.
var maxUploadBytes int64 = defaultMaxUploadBytes

// parseUploadLimit reads UPLOAD_MAX_BYTES: empty means the default, anything else must be a positive integer.
func parseUploadLimit(raw string) (int64, error) {
	if raw == "" {
		return defaultMaxUploadBytes, nil
	}
	limit, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || limit <= 0 {
		return 0, errors.New("UPLOAD_MAX_BYTES must be a positive integer number of bytes")
	}
	return limit, nil
}

// LoadUploadLimit applies UPLOAD_MAX_BYTES; an invalid value is a startup error.
func LoadUploadLimit() error {
	limit, err := parseUploadLimit(os.Getenv("UPLOAD_MAX_BYTES"))
	if err != nil {
		return err
	}
	maxUploadBytes = limit
	return nil
}

func (b *Browse) GetObjects(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	bucket := r.PathValue("bucket")
	prefix := query.Get("prefix")
	continuationToken := query.Get("next")

	limit := 100
	if query.Has("limit") {
		var err error
		if limit, err = strconv.Atoi(query.Get("limit")); err != nil || limit < 1 || limit > 1000 {
			utils.ResponseErrorStatus(w, errors.New("limit must be a whole number from 1 to 1000"), http.StatusBadRequest)
			return
		}
	}

	client, err := getS3Client(bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	objects, err := client.ListObjectsV2(r.Context(), &s3.ListObjectsV2Input{
		Bucket:            aws.String(bucket),
		Prefix:            aws.String(prefix),
		Delimiter:         aws.String("/"),
		MaxKeys:           aws.Int32(int32(limit)),
		ContinuationToken: aws.String(continuationToken),
	})

	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	result := schema.BrowseObjectResult{
		Prefixes:  []string{},
		Objects:   []schema.BrowserObject{},
		Prefix:    prefix,
		NextToken: objects.NextContinuationToken,
	}

	for _, prefix := range objects.CommonPrefixes {
		result.Prefixes = append(result.Prefixes, *prefix.Prefix)
	}

	for _, object := range objects.Contents {
		key := strings.TrimPrefix(*object.Key, prefix)
		if key == "" {
			continue
		}

		result.Objects = append(result.Objects, schema.BrowserObject{
			ObjectKey:    &key,
			LastModified: object.LastModified,
			Size:         object.Size,
			Url:          fmt.Sprintf("/browse/%s/%s", url.PathEscape(bucket), url.PathEscape(*object.Key)),
		})
	}

	utils.ResponseSuccess(w, result)
}

func (b *Browse) GetOneObject(w http.ResponseWriter, r *http.Request) {
	// Stored objects are untrusted content, never part of the admin application.
	w.Header().Set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'")
	bucket := r.PathValue("bucket")
	key := r.PathValue("key")
	queryParams := r.URL.Query()
	view := queryParams.Get("view") == "1"
	thumbnail := queryParams.Get("thumb") == "1"
	download := queryParams.Get("dl") == "1"
	// A download wins over thumb=1: it streams the whole object and never takes a thumbnail slot.
	asThumbnail := thumbnail && !download

	client, err := getS3Client(bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	if !view && !download && !thumbnail {
		serveHead(r.Context(), w, client, bucket, key)
		return
	}

	if asThumbnail {
		// Wait for a slot before touching S3, so a queued request holds no response, body or connection.
		select {
		case thumbnailSlots <- struct{}{}:
			defer func() { <-thumbnailSlots }()
		case <-r.Context().Done():
			return
		}
	}

	object, err := client.GetObject(r.Context(), &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		var ae smithy.APIError
		if errors.As(err, &ae) && ae.ErrorCode() == "NoSuchKey" {
			utils.ResponseErrorStatus(w, err, http.StatusNotFound)
			return
		}

		utils.ResponseError(w, err)
		return
	}

	defer object.Body.Close()
	keys := strings.Split(key, "/")

	// Every response below carries private object data, including thumbnails.
	w.Header().Set("Cache-Control", "no-store")

	if download {
		w.Header().Set("Content-Disposition", attachmentDisposition(keys[len(keys)-1]))
	} else if asThumbnail {
		serveThumbnail(w, object.Body)
		return
	}

	streamObject(w, object)
}

// serveHead answers with the object's metadata as JSON.
func serveHead(ctx context.Context, w http.ResponseWriter, client *s3.Client, bucket, key string) {
	object, err := client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		utils.ResponseError(w, err)
		return
	}
	utils.ResponseSuccess(w, object)
}

// maxThumbnailBytes bounds the object read to make a thumbnail: a file larger than this is not
// worth buffering for a 64 px preview, and the browser requests thumbnails unasked.
const maxThumbnailBytes = 10 << 20

// thumbnailSlots caps concurrent thumbnail requests, from the S3 read to the decode: a page asks for
// many thumbnails at once, and each holds up to maxThumbnailBytes of input and utils.MaxThumbnailPixels
// of pixels. GetOneObject takes a slot before it calls S3.
var thumbnailSlots = make(chan struct{}, 2)

// serveThumbnail answers with a 64x64 thumbnail of the image in body. An object over the byte or
// pixel limit gets 413 or 422 and is never decoded; the page then shows its empty thumbnail box.
func serveThumbnail(w http.ResponseWriter, body io.Reader) {
	data, err := io.ReadAll(io.LimitReader(body, maxThumbnailBytes+1))
	if err != nil {
		utils.ResponseError(w, err)
		return
	}
	if len(data) > maxThumbnailBytes {
		utils.ResponseErrorStatus(w, errors.New("object too large for a thumbnail"), http.StatusRequestEntityTooLarge)
		return
	}

	thumb, err := utils.CreateThumbnailImage(data, 64, 64)
	if errors.Is(err, utils.ErrImageTooLarge) {
		utils.ResponseErrorStatus(w, err, http.StatusUnprocessableEntity)
		return
	}
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	w.Header().Set("Content-Type", "image/jpeg") // CreateThumbnailImage encodes JPEG
	w.Write(thumb)
}

// streamObject copies the object to the response with its stored headers.
func streamObject(w http.ResponseWriter, object *s3.GetObjectOutput) {
	w.Header().Set("Last-Modified", object.LastModified.Format(time.RFC1123))

	if object.ContentType != nil {
		w.Header().Set("Content-Type", *object.ContentType)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	if object.ContentLength != nil {
		w.Header().Set("Content-Length", strconv.FormatInt(*object.ContentLength, 10))
	}
	if object.ETag != nil {
		w.Header().Set("Etag", *object.ETag)
	}

	_, err := io.Copy(w, object.Body)

	if err != nil {
		utils.ResponseError(w, err)
		return
	}
}

func (b *Browse) PutObject(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	key := r.PathValue("key")
	isDirectory := strings.HasSuffix(key, "/")

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	file, headers, err := r.FormFile("file")
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		utils.ResponseErrorStatus(w, fmt.Errorf("upload too large: the limit is %d bytes (UPLOAD_MAX_BYTES)", tooLarge.Limit), http.StatusRequestEntityTooLarge)
		return
	}
	if err != nil && !isDirectory {
		utils.ResponseError(w, err)
		return
	}

	if file != nil {
		defer file.Close()
	}

	client, err := getS3Client(bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	var contentType string = ""
	var size int64 = 0

	if file != nil {
		contentType = headers.Header.Get("Content-Type")
		size = headers.Size
	}

	result, err := client.PutObject(r.Context(), &s3.PutObjectInput{
		Bucket:        aws.String(bucket),
		Key:           aws.String(key),
		Body:          file,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String(contentType),
	})

	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot put object: %w", err))
		return
	}

	utils.ResponseSuccess(w, result)
}

func (b *Browse) DeleteObject(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")
	key := r.PathValue("key")
	recursive := r.URL.Query().Get("recursive") == "true"
	isDirectory := strings.HasSuffix(key, "/")

	client, err := getS3Client(bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	// Delete directory and its content
	if isDirectory && recursive {
		if err := deletePrefix(r.Context(), client, bucket, key); err != nil {
			utils.ResponseError(w, err)
			return
		}
		utils.ResponseSuccess(w, true)
		return
	}

	// Delete single object
	res, err := client.DeleteObject(r.Context(), &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		utils.ResponseError(w, fmt.Errorf("cannot delete object: %w", err))
		return
	}

	utils.ResponseSuccess(w, res)
}

var errNoBucketKey = errors.New("no access key with read and write permission is granted on this bucket")

// deletePrefix deletes every object under prefix: it pages through the listing to the end and
// deletes each page in one batch (S3 allows 1000 keys per call). Objects that cannot be deleted do
// not stop the rest; they are counted and the first one is named in the error.
func deletePrefix(ctx context.Context, client *s3.Client, bucket, prefix string) error {
	pages := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket:  aws.String(bucket),
		Prefix:  aws.String(prefix),
		MaxKeys: aws.Int32(1000),
	})

	seen, failed := 0, 0
	var first *types.Error
	for pages.HasMorePages() {
		page, err := pages.NextPage(ctx)
		if err != nil {
			return err
		}
		if len(page.Contents) == 0 {
			continue
		}

		keys := make([]types.ObjectIdentifier, 0, len(page.Contents))
		for _, object := range page.Contents {
			keys = append(keys, types.ObjectIdentifier{Key: object.Key})
		}
		seen += len(keys)

		res, err := client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: aws.String(bucket),
			Delete: &types.Delete{Objects: keys, Quiet: aws.Bool(true)},
		})
		if err != nil {
			return fmt.Errorf("cannot delete object: %w", err)
		}
		if failed == 0 && len(res.Errors) > 0 {
			first = &res.Errors[0]
		}
		failed += len(res.Errors)
	}

	if failed > 0 {
		return fmt.Errorf("cannot delete %d of %d objects; first failure: %s (%s: %s)",
			failed, seen, aws.ToString(first.Key), aws.ToString(first.Code), aws.ToString(first.Message))
	}
	return nil
}

func getBucketCredentials(bucket string) (aws.CredentialsProvider, error) {
	cacheKey := fmt.Sprintf("key:%s", bucket)
	cacheData := utils.Cache.Get(cacheKey)

	if cacheData != nil {
		return cacheData.(aws.CredentialsProvider), nil
	}

	bucketData, err := utils.FetchJSON[schema.Bucket]("/v2/GetBucketInfo?" + url.Values{"globalAlias": {bucket}}.Encode())
	if err != nil {
		return nil, err
	}

	var key schema.KeyElement

	for _, k := range bucketData.Keys {
		if !k.Permissions.Read || !k.Permissions.Write {
			continue
		}

		key, err = utils.FetchJSON[schema.KeyElement]("/v2/GetKeyInfo?" + url.Values{"id": {k.AccessKeyID}, "showSecretKey": {"true"}}.Encode())
		if err != nil {
			return nil, err
		}
		break
	}

	// Never cache an empty credential: the next request must look again, so a granted key works at once.
	if key.AccessKeyID == "" || key.SecretAccessKey == "" {
		return nil, errNoBucketKey
	}

	credential := credentials.NewStaticCredentialsProvider(key.AccessKeyID, key.SecretAccessKey, "")
	utils.Cache.Set(cacheKey, credential, time.Hour)

	return credential, nil
}

// s3HTTPClient carries every S3 call, so keep-alive connections are shared across requests instead
// of idling per client for 90 s (that exhausted Garage's file descriptors). It bounds connecting
// and the TLS handshake, never the whole call: uploads and downloads stream up to the size cap.
// The SDK defaults stay otherwise: proxy from the environment, HTTP/2 when the endpoint offers it.
var s3HTTPClient = awshttp.NewBuildableClient().
	WithDialerOptions(func(d *net.Dialer) { d.Timeout = 5 * time.Second }).
	WithTransportOptions(func(t *http.Transport) {
		t.TLSHandshakeTimeout = 5 * time.Second
		t.MaxIdleConns = 64
		t.MaxIdleConnsPerHost = 16
		t.IdleConnTimeout = 30 * time.Second
	})

func getS3Client(bucket string) (*s3.Client, error) {
	creds, err := getBucketCredentials(bucket)
	if err != nil {
		return nil, fmt.Errorf("cannot get credentials for bucket %s: %w", bucket, err)
	}

	// Determine endpoint and whether to disable HTTPS
	endpoint := utils.Garage.GetS3Endpoint()
	disableHTTPS := !strings.HasPrefix(endpoint, "https://")

	// AWS config without BaseEndpoint
	awsConfig := aws.Config{
		Credentials: creds,
		Region:      utils.Garage.GetS3Region(),
		HTTPClient:  s3HTTPClient,
	}

	// Build S3 client with custom endpoint resolver for proper signing
	client := s3.NewFromConfig(awsConfig, func(o *s3.Options) {
		o.UsePathStyle = true
		o.EndpointOptions.DisableHTTPS = disableHTTPS
		o.EndpointResolver = s3.EndpointResolverFunc(func(region string, opts s3.EndpointResolverOptions) (aws.Endpoint, error) {
			return aws.Endpoint{
				URL:           endpoint,
				SigningRegion: utils.Garage.GetS3Region(),
			}, nil
		})
	})

	return client, nil
}
