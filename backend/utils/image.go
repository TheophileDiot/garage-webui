package utils

import (
	"bytes"
	"errors"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"

	"github.com/nfnt/resize"
)

// MaxThumbnailPixels bounds the decoded size of a source image: 16 MP covers a 4:3 phone photo
// (12 MP) and keeps one decode under about 64 MB (8-bit RGBA), 128 MB at 16 bits per channel.
const MaxThumbnailPixels = 16 << 20

// ErrImageTooLarge is returned for an image whose declared dimensions exceed MaxThumbnailPixels.
var ErrImageTooLarge = errors.New("image dimensions exceed the thumbnail limit")

func CreateThumbnailImage(buffer []byte, width uint, height uint) ([]byte, error) {
	// The header alone says how much memory a decode allocates, so check it first. Go's GIF
	// decoder refuses a frame larger than the screen, so the header bounds GIFs too.
	cfg, _, err := image.DecodeConfig(bytes.NewReader(buffer))
	if err != nil {
		return nil, err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || int64(cfg.Width)*int64(cfg.Height) > MaxThumbnailPixels {
		return nil, ErrImageTooLarge
	}

	img, _, err := image.Decode(bytes.NewReader(buffer))
	if err != nil {
		return nil, err
	}

	thumb := resize.Thumbnail(width, height, img, resize.NearestNeighbor)
	buf := new(bytes.Buffer)
	if err := jpeg.Encode(buf, thumb, nil); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
