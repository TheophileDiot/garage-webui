package router

import (
	"errors"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/utils"
	"net/http"
	"net/url"
	"sync"
)

type Buckets struct{}

const maxBucketFanout = 8

func (b *Buckets) GetAll(w http.ResponseWriter, r *http.Request) {
	buckets, err := utils.FetchJSON[[]schema.GetBucketsRes]("/v2/ListBuckets")
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	// At most maxBucketFanout detail calls at once; results keep the order Garage listed them in.
	details := make([]*schema.Bucket, len(buckets))
	slots := make(chan struct{}, maxBucketFanout)
	var wg sync.WaitGroup
	for i, bucket := range buckets {
		slots <- struct{}{}
		wg.Add(1)
		go func() {
			defer func() { <-slots; wg.Done() }()
			data, err := utils.FetchJSON[schema.Bucket]("/v2/GetBucketInfo?" + url.Values{"id": {bucket.ID}}.Encode())
			if err != nil {
				return
			}

			data.LocalAliases = bucket.LocalAliases
			details[i] = &data
		}()
	}
	wg.Wait()

	res := make([]schema.Bucket, 0, len(buckets))
	for _, bucket := range details {
		if bucket == nil {
			utils.ResponseError(w, errors.New("bucket details unavailable; retry when Garage is reachable"))
			return
		}
		res = append(res, *bucket)
	}

	utils.ResponseSuccess(w, res)
}
