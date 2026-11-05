package router

import (
	"fmt"
	"mime"
	"strings"
	"unicode"
)

// attachmentDisposition builds a Content-Disposition value that downloads name (RFC 6266). The name is
// attacker-influenced (it is an object key), so control characters and path separators are replaced and
// the value is quoted by mime.FormatMediaType. A name with non-ASCII text gets an ASCII fallback in
// filename plus the real name in filename* (RFC 5987), which every current browser prefers.
func attachmentDisposition(name string) string {
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || r == '/' || r == '\\' {
			return '_'
		}
		return r
	}, strings.ToValidUTF8(name, "_"))
	if name == "" {
		name = "download"
	}
	fallback := strings.Map(func(r rune) rune {
		if r > unicode.MaxASCII {
			return '_'
		}
		return r
	}, name)
	value := mime.FormatMediaType("attachment", map[string]string{"filename": fallback})
	if value == "" {
		value = "attachment"
	}
	if fallback != name {
		value += "; filename*=UTF-8''" + percentEncode(name)
	}
	return value
}

// percentEncode encodes s for an RFC 5987 ext-value: everything outside attr-char becomes %XX.
func percentEncode(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || strings.IndexByte("!#$&+-.^_`|~", c) >= 0 {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}
