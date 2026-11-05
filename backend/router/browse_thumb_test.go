package router

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
)

func encodePNG(t *testing.T, w, h int) []byte {
	t.Helper()
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewRGBA(image.Rect(0, 0, w, h))); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// bombPNG is a few dozen bytes whose IHDR declares w x h and which has no pixel data at all.
func bombPNG(w, h uint32) []byte {
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], w)
	binary.BigEndian.PutUint32(ihdr[4:], h)
	ihdr[8], ihdr[9] = 8, 6 // 8 bits, RGBA
	var b bytes.Buffer
	b.WriteString("\x89PNG\r\n\x1a\n")
	chunk := append([]byte("IHDR"), ihdr...)
	binary.Write(&b, binary.BigEndian, uint32(13))
	b.Write(chunk)
	binary.Write(&b, binary.BigEndian, crc32.ChecksumIEEE(chunk))
	return b.Bytes()
}

// fullBombPNG is a complete, valid PNG of w x h blank RGBA pixels: a few hundred KB that decode to w*h*4 bytes.
func fullBombPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	var idat bytes.Buffer
	z := zlib.NewWriter(&idat)
	row := make([]byte, 1+4*w)
	for y := 0; y < h; y++ {
		z.Write(row)
	}
	z.Close()
	b := bombPNG(uint32(w), uint32(h))
	for _, c := range []struct {
		kind string
		data []byte
	}{{"IDAT", idat.Bytes()}, {"IEND", nil}} {
		b = binary.BigEndian.AppendUint32(b, uint32(len(c.data)))
		chunk := append([]byte(c.kind), c.data...)
		b = append(b, chunk...)
		b = binary.BigEndian.AppendUint32(b, crc32.ChecksumIEEE(chunk))
	}
	return b
}

// bombJPEG is a baseline JPEG whose frame header declares w x h and which stops after the scan header.
func bombJPEG(w, h uint16) []byte {
	b := []byte{0xff, 0xd8, 0xff, 0xc0, 0, 11, 8}
	b = binary.BigEndian.AppendUint16(b, h)
	b = binary.BigEndian.AppendUint16(b, w)
	return append(b, 1, 1, 0x11, 0, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0) // frame header, then a scan header
}

// totalAlloc is the bytes the process allocated while f ran.
func totalAlloc(f func()) uint64 {
	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)
	f()
	runtime.ReadMemStats(&after)
	return after.TotalAlloc - before.TotalAlloc
}

// A tiny file declaring huge dimensions must be refused before its pixel buffer is allocated.
func TestThumbnailRefusesDecompressionBombs(t *testing.T) {
	var blank bytes.Buffer
	if err := jpeg.Encode(&blank, image.NewGray(image.Rect(0, 0, 8000, 8000)), nil); err != nil {
		t.Fatal(err)
	}
	bombs := map[string][]byte{
		"png 8000x8000 (64 MP, complete file)":  fullBombPNG(t, 8000, 8000),
		"jpeg 8000x8000 (64 MP, complete file)": blank.Bytes(),
		"png header 20000x20000":                bombPNG(20000, 20000),
		"jpeg header 20000x20000":               bombJPEG(20000, 20000),
		"png header 5000x5000 (25 MP)":          bombPNG(5000, 5000),
	}
	for name, body := range bombs {
		t.Run(name, func(t *testing.T) {
			ext := "png"
			if body[0] == 0xff {
				ext = "jpg"
			}
			var res *httptest.ResponseRecorder
			alloc := totalAlloc(func() { res = browseOne(t, "bomb."+ext, "thumb=1", body, "image/"+ext) })
			t.Logf("%s: %d, %d bytes allocated", name, res.Code, alloc)
			if res.Code != http.StatusUnprocessableEntity {
				t.Errorf("status %d, want 422", res.Code)
			}
			if alloc > 64<<20 {
				t.Errorf("%d bytes allocated for a %d-byte file", alloc, len(body))
			}
		})
	}
}

func TestThumbnailRefusesOversizedObjects(t *testing.T) {
	body := append(encodePNG(t, 8, 8), make([]byte, 11<<20)...) // a valid PNG, then trailing bytes
	res := browseOne(t, "big.png", "thumb=1", body, "image/png")
	if res.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status %d, want 413", res.Code)
	}
	if res.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("Cache-Control = %q", res.Header().Get("Cache-Control"))
	}
}

func TestThumbnailStillServesNormalImages(t *testing.T) {
	var j bytes.Buffer
	if err := jpeg.Encode(&j, image.NewRGBA(image.Rect(0, 0, 4000, 3000)), nil); err != nil { // a 12 MP phone photo
		t.Fatal(err)
	}
	for name, tc := range map[string]struct {
		key  string
		body []byte
	}{"png": {"a.png", encodePNG(t, 200, 100)}, "12 MP jpeg": {"a.jpg", j.Bytes()}} {
		t.Run(name, func(t *testing.T) {
			res := browseOne(t, tc.key, "thumb=1", tc.body, "image/x")
			if res.Code != 200 || res.Header().Get("Content-Type") != "image/jpeg" {
				t.Fatalf("%d %s", res.Code, res.Header().Get("Content-Type"))
			}
			img, _, err := image.Decode(res.Body)
			if err != nil || img.Bounds().Dx() > 64 || img.Bounds().Dy() > 64 {
				t.Fatalf("thumbnail: %v %v", err, img)
			}
		})
	}
}
