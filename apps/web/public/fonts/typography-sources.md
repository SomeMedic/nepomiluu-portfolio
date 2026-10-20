# Local editorial fonts

Retrieved: 2026-10-19T19:19:41Z.

Official Google Fonts CSS request: [https://fonts.googleapis.com/css2?family=Prata&family=Playfair+Display:ital,wght@1,700&display=swap](https://fonts.googleapis.com/css2?family=Prata&family=Playfair+Display:ital,wght@1,700&display=swap).

User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36.

Prata: normal 400 only. Playfair Display: genuine italic 700. Files are unmodified official WOFF2 subsets. Cyrillic and Latin are included; Prata additionally includes Cyrillic Extended, and Playfair Display includes Latin Extended as supplied by the API. Vietnamese subsets were not included. Existing study TTF files, font CSS and components were not modified.

Both families use SIL Open Font License 1.1. Keep the corresponding copyright and OFL files with redistributed font binaries. Full license text is authoritative.

## Binaries

| File | Family | Style | Weight | Subset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | ---: | --- |
| [playfair-display-700-italic-cyrillic.woff2](https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_k-UXtXA-W2r.woff2) | Playfair Display | italic | 700 | cyrillic | 13520 | 125eeaf2b6aee540df095c6ae939a9ca42075983708ffd234d858727b1864f2e |
| [playfair-display-700-italic-latin-ext.woff2](https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_k-UXt_A-W2r.woff2) | Playfair Display | italic | 700 | latin-ext | 14128 | 8af70f52c55bb5cd12b43f2096f926280b099def7334690934282435b16ff18d |
| [playfair-display-700-italic-latin.woff2](https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_k-UXtHA-Q.woff2) | Playfair Display | italic | 700 | latin | 23196 | de2f4041e7ef84f418bd0144484e521e8df849aff47762230c981704b9661877 |
| [prata-400-normal-cyrillic-ext.woff2](https://fonts.gstatic.com/s/prata/v22/6xKhdSpbNNCT-sWCCm7JLQ.woff2) | Prata | normal | 400 | cyrillic-ext | 12868 | 1a71ca94e943aac8154d195f9ea21959d374ebf3a3a9420651d0dbb46253f897 |
| [prata-400-normal-cyrillic.woff2](https://fonts.gstatic.com/s/prata/v22/6xKhdSpbNNCT-sWLCm7JLQ.woff2) | Prata | normal | 400 | cyrillic | 13132 | 3392de5a383deac60effcad2beb8b847f40eb0eb200ffd4888c3e13d6e40845f |
| [prata-400-normal-latin.woff2](https://fonts.gstatic.com/s/prata/v22/6xKhdSpbNNCT-sWPCm4.woff2) | Prata | normal | 400 | latin | 19224 | 1b85a8c794709747c9f689b791984c430a2d9716a5cf9440d955bd7d20dad9d0 |

## Licenses

- [prata-OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/prata/OFL.txt), SHA-256: 1e055d25bde41906cc2e1a08bc156e7776d5084e1640d75dbd0065a937b488e3.
- [playfair-display-OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/OFL.txt), SHA-256: 566be814f8e96e93dfa16101331557eb6b5467e9e03f627c0910fe93ca12300e.

## Local @font-face declarations

Add these declarations to the existing fonts stylesheet. No runtime requests to Google are needed.

~~~css
/* Playfair Display - cyrillic */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/playfair-display-700-italic-cyrillic.woff2') format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}

/* Playfair Display - latin-ext */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/playfair-display-700-italic-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}

/* Playfair Display - latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/playfair-display-700-italic-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* Prata - cyrillic-ext */
@font-face {
  font-family: 'Prata';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/prata-400-normal-cyrillic-ext.woff2') format('woff2');
  unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
}

/* Prata - cyrillic */
@font-face {
  font-family: 'Prata';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/prata-400-normal-cyrillic.woff2') format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}

/* Prata - latin */
@font-face {
  font-family: 'Prata';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/prata-400-normal-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
~~~
