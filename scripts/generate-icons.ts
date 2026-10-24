/**
 * Regenerates every app icon in `public/` from one camera glyph, tinted with
 * the Glassmorphism palette (see docs/design-system/glassmorphism/tokens.json).
 *
 *   bun scripts/generate-icons.ts
 *
 * Rasterises with Playwright's Chromium for clean anti-aliasing. If the
 * installed browser doesn't match the `playwright` package version, point
 * CHROMIUM_PATH at a Chromium binary.
 */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BRAND_STRONG = '#1856ff' // --gl-accent-strong: icon background
const ACCENT = '#4f8cff' // --gl-accent: favicon glyph on dark browser chrome
const ON_BRAND = '#ffffff' // --gl-accent-on: glyph on the brand fill

// Surveillance camera glyph on a 512×512 grid (source: public/surveillance-camera-1.svg).
const GLYPH = `
  <polygon points="374.573,52.291 18.91,199.784 133.446,359.567 447.708,229.19"/>
  <polygon points="0,263.014 40.458,360.869 90.919,340.01 27.556,251.617"/>
  <path d="M480.533,352.462v41.408h-78.264c-4.411-8.449-13.246-14.232-23.447-14.232c-2.329,0-4.573,0.331-6.725,0.901
    l-36.751-46.424c1.478-3.299,2.315-6.943,2.315-10.791c0-14.611-11.84-26.444-26.444-26.444c-14.605,0-26.451,11.833-26.451,26.444
    c0,14.612,11.846,26.444,26.451,26.444c1.702,0,3.363-0.176,4.966-0.478l37.82,47.76c-1.034,2.828-1.624,5.853-1.624,9.039
    c0,14.612,11.839,26.444,26.444,26.444c10.2,0,19.036-5.776,23.447-14.231h78.264v41.407H512V352.462H480.533z"/>`

// Glyph placement, unchanged from the original icons: "any" icons fill ~83%
// of the canvas; maskable icons keep the glyph inside the 80% safe zone.
const ANY = { offset: 44, scale: 0.832 }
const MASKABLE = { offset: 94, scale: 0.633 }

function tile({ offset, scale }: { offset: number; scale: number }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND_STRONG}"/>
  <g fill="${ON_BRAND}" transform="translate(${offset} ${offset}) scale(${scale})">${GLYPH}
  </g>
</svg>
`
}

// Browser-tab favicon: glyph only, brand blue, lighter accent on dark chrome.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <style>
    .icon { fill: ${BRAND_STRONG}; }
    @media (prefers-color-scheme: dark) {
      .icon { fill: ${ACCENT}; }
    }
  </style>
  <g class="icon">${GLYPH}
  </g>
</svg>
`

const PNGS: { file: string; size: number; svg: string }[] = [
  { file: 'icon-192.png', size: 192, svg: tile(ANY) },
  { file: 'icon-512.png', size: 512, svg: tile(ANY) },
  { file: 'apple-touch-icon.png', size: 180, svg: tile(ANY) },
  { file: 'icon-maskable-192.png', size: 192, svg: tile(MASKABLE) },
  { file: 'icon-maskable-512.png', size: 512, svg: tile(MASKABLE) },
]
const ICO_SIZES = [16, 32, 48]

/** Packs PNG images into a .ico container (PNG-compressed entries). */
function packIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size, 0) // width
    entry.writeUInt8(size, 1) // height
    entry.writeUInt8(0, 2) // palette size
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

async function main() {
  const publicDir = fileURLToPath(new URL('../public', import.meta.url))
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  })
  const page = await browser.newPage()

  async function render(svg: string, size: number): Promise<Buffer> {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    )
    return page.screenshot({ omitBackground: true })
  }

  try {
    for (const { file, size, svg } of PNGS) {
      await writeFile(join(publicDir, file), await render(svg, size))
      console.log(`wrote public/${file}`)
    }

    const icoImages = []
    for (const size of ICO_SIZES) {
      icoImages.push({ size, png: await render(tile(ANY), size) })
    }
    await writeFile(join(publicDir, 'favicon.ico'), packIco(icoImages))
    console.log('wrote public/favicon.ico')

    await writeFile(join(publicDir, 'favicon.svg'), FAVICON_SVG)
    console.log('wrote public/favicon.svg')
  } finally {
    await browser.close()
  }
}

await main()
