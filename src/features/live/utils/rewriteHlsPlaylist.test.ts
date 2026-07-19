import { describe, expect, it } from 'vitest'
import { rewriteHlsPlaylist } from './rewriteHlsPlaylist'

describe('rewriteHlsPlaylist', () => {
  it('rewrites a plain segment line to the proxy URL with the ref URL-encoded', () => {
    const input = 'segment0.mp4'
    const output = rewriteHlsPlaylist(input, 'front_porch')

    expect(output).toBe(
      `/api/live/front_porch/segment?ref=${encodeURIComponent('segment0.mp4')}`,
    )
  })

  it('rewrites the #EXT-X-MAP URI value but preserves the tag', () => {
    const input = '#EXT-X-MAP:URI="init.mp4?src=front_porch"'
    const output = rewriteHlsPlaylist(input, 'front_porch')

    expect(output).toBe(
      `#EXT-X-MAP:URI="/api/live/front_porch/segment?ref=${encodeURIComponent(
        'init.mp4?src=front_porch',
      )}"`,
    )
  })

  it('rewrites the #EXT-X-KEY URI while preserving METHOD and IV attributes', () => {
    const input =
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin?src=front_porch",IV=0x00000000000000000000000000000001'
    const output = rewriteHlsPlaylist(input, 'front_porch')

    expect(output).toBe(
      `#EXT-X-KEY:METHOD=AES-128,URI="/api/live/front_porch/segment?ref=${encodeURIComponent(
        'key.bin?src=front_porch',
      )}",IV=0x00000000000000000000000000000001`,
    )
  })

  it('passes #EXTM3U through unchanged', () => {
    expect(rewriteHlsPlaylist('#EXTM3U', 'front_porch')).toBe('#EXTM3U')
  })

  it('passes #EXT-X-VERSION through unchanged', () => {
    expect(rewriteHlsPlaylist('#EXT-X-VERSION:7', 'front_porch')).toBe(
      '#EXT-X-VERSION:7',
    )
  })

  it('passes #EXTINF through unchanged', () => {
    expect(rewriteHlsPlaylist('#EXTINF:2.000,', 'front_porch')).toBe(
      '#EXTINF:2.000,',
    )
  })

  it('passes #EXT-X-ENDLIST through unchanged', () => {
    expect(rewriteHlsPlaylist('#EXT-X-ENDLIST', 'front_porch')).toBe(
      '#EXT-X-ENDLIST',
    )
  })

  it('passes blank lines through unchanged', () => {
    const input = '#EXTM3U\n\n#EXT-X-ENDLIST'
    expect(rewriteHlsPlaylist(input, 'front_porch')).toBe(input)
  })

  it('preserves query strings in refs by URL-encoding them', () => {
    const input = 'segment42.m4s?src=front_porch&id=abc-DEF_9'
    const output = rewriteHlsPlaylist(input, 'front_porch')

    expect(output).toBe(
      `/api/live/front_porch/segment?ref=${encodeURIComponent(
        'segment42.m4s?src=front_porch&id=abc-DEF_9',
      )}`,
    )
  })

  it('leaves an absolute https:// segment line unchanged', () => {
    const input = 'https://cdn.example.com/segment0.mp4'
    expect(rewriteHlsPlaylist(input, 'front_porch')).toBe(input)
  })

  it('leaves an absolute http:// segment line unchanged', () => {
    const input = 'http://cdn.example.com/segment0.mp4'
    expect(rewriteHlsPlaylist(input, 'front_porch')).toBe(input)
  })

  it('leaves an absolute https:// EXT-X-MAP URI unchanged', () => {
    const input = '#EXT-X-MAP:URI="https://cdn.example.com/init.mp4"'
    expect(rewriteHlsPlaylist(input, 'front_porch')).toBe(input)
  })

  it('URL-encodes the camera name in the proxy path', () => {
    const output = rewriteHlsPlaylist('segment0.mp4', 'front porch')

    expect(output).toBe(
      `/api/live/${encodeURIComponent('front porch')}/segment?ref=${encodeURIComponent('segment0.mp4')}`,
    )
  })

  it('round-trips a realistic multi-line fMP4 media playlist', () => {
    const input = [
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      '#EXT-X-TARGETDURATION:2',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-MAP:URI="init.mp4?src=front_porch"',
      '#EXTINF:2.000,',
      'segment0.mp4?src=front_porch',
      '#EXTINF:2.000,',
      'segment1.mp4?src=front_porch',
      '#EXT-X-ENDLIST',
    ].join('\n')

    const expected = [
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      '#EXT-X-TARGETDURATION:2',
      '#EXT-X-MEDIA-SEQUENCE:0',
      `#EXT-X-MAP:URI="/api/live/front_porch/segment?ref=${encodeURIComponent(
        'init.mp4?src=front_porch',
      )}"`,
      '#EXTINF:2.000,',
      `/api/live/front_porch/segment?ref=${encodeURIComponent(
        'segment0.mp4?src=front_porch',
      )}`,
      '#EXTINF:2.000,',
      `/api/live/front_porch/segment?ref=${encodeURIComponent(
        'segment1.mp4?src=front_porch',
      )}`,
      '#EXT-X-ENDLIST',
    ].join('\n')

    expect(rewriteHlsPlaylist(input, 'front_porch')).toBe(expected)
  })
})
