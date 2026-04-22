#!/usr/bin/env node
/**
 * Generates favicon and PWA icons from surveillance-camera-1.svg.
 * Run: node scripts/generate-icons.mjs
 * Requires: npm install sharp (dev dependency)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const originalSvg = readFileSync(
  join(publicDir, 'surveillance-camera-1.svg'),
  'utf-8',
)

// Extract just the path data from the SVG for reuse
const pathData = `
  <polygon points="374.573,52.291 18.91,199.784 133.446,359.567 447.708,229.19"/>
  <polygon points="0,263.014 40.458,360.869 90.919,340.01 27.556,251.617"/>
  <path d="M480.533,352.462v41.408h-78.264c-4.411-8.449-13.246-14.232-23.447-14.232c-2.329,0-4.573,0.331-6.725,0.901
    l-36.751-46.424c1.478-3.299,2.315-6.943,2.315-10.791c0-14.611-11.84-26.444-26.444-26.444c-14.605,0-26.451,11.833-26.451,26.444
    c0,14.612,11.846,26.444,26.451,26.444c1.702,0,3.363-0.176,4.966-0.478l37.82,47.76c-1.034,2.828-1.624,5.853-1.624,9.039
    c0,14.612,11.839,26.444,26.444,26.444c10.2,0,19.036-5.776,23.447-14.231h78.264v41.407H512V352.462H480.533z"/>
`

// Padded SVG with the camera icon centered (add padding for maskable safe zone)
function makeSvg({ fg, bg, padding = 0 }) {
  const p = padding
  const inner = 512
  const size = inner + p * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}" rx="0"/>
  <g transform="translate(${p}, ${p})" fill="${fg}">
    ${pathData}
  </g>
</svg>`
}

// Light mode favicon SVG (dark icon on transparent bg for light browser chrome)
// Dark mode favicon SVG (light icon on transparent bg for dark browser chrome)
// Combined with prefers-color-scheme media query
function makeFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <style>
    .icon { fill: #173a40; }
    @media (prefers-color-scheme: dark) {
      .icon { fill: #e8e6e3; }
    }
  </style>
  <g class="icon">
    ${pathData}
  </g>
</svg>`
}

// Write the adaptive SVG favicon (supports light/dark via CSS media query)
writeFileSync(join(publicDir, 'favicon.svg'), makeFaviconSvg())
console.log('✓ favicon.svg (adaptive light/dark)')

// Now generate PNG icons using sharp
const sharp = (await import('sharp')).default

// PWA icons - use the app's theme colors
const variants = [
  // Standard icons (any) - colored bg matching the app theme
  {
    name: 'icon-192.png',
    size: 192,
    fg: '#e7f3ec',
    bg: '#173a40',
    padding: 20,
    purpose: 'any',
  },
  {
    name: 'icon-512.png',
    size: 512,
    fg: '#e7f3ec',
    bg: '#173a40',
    padding: 52,
    purpose: 'any',
  },
  // Maskable icons - extra padding (safe zone is inner 80% circle)
  // padding = size * 0.1 (10% on each side = 80% content area)
  {
    name: 'icon-maskable-192.png',
    size: 192,
    fg: '#e7f3ec',
    bg: '#173a40',
    padding: 56,
    purpose: 'maskable',
  },
  {
    name: 'icon-maskable-512.png',
    size: 512,
    fg: '#e7f3ec',
    bg: '#173a40',
    padding: 148,
    purpose: 'maskable',
  },
  // Apple touch icon (180x180) - Apple requires opaque bg
  {
    name: 'apple-touch-icon.png',
    size: 180,
    fg: '#e7f3ec',
    bg: '#173a40',
    padding: 22,
    purpose: 'apple',
  },
]

for (const v of variants) {
  const svg = makeSvg({ fg: v.fg, bg: v.bg, padding: v.padding })
  const svgSize = 512 + v.padding * 2
  const buf = Buffer.from(svg)
  await sharp(buf, { density: Math.round((72 * v.size) / svgSize) })
    .resize(v.size, v.size)
    .png()
    .toFile(join(publicDir, v.name))
  console.log(`✓ ${v.name} (${v.size}x${v.size}, ${v.purpose})`)
}

// Generate favicon.ico (multi-size: 16, 32, 48)
// sharp can produce individual PNGs; we'll create a simple .ico from 32x32
const icoSvg = makeSvg({ fg: '#e7f3ec', bg: '#173a40', padding: 4 })
const icoSizes = [16, 32, 48]
const icoBuffers = []
for (const size of icoSizes) {
  const buf = await sharp(Buffer.from(icoSvg))
    .resize(size, size)
    .png()
    .toBuffer()
  icoBuffers.push({ size, buf })
}

// Build ICO file manually (ICO format)
function buildIco(images) {
  const headerSize = 6
  const dirEntrySize = 16
  const dataOffset = headerSize + dirEntrySize * images.length

  let totalSize = dataOffset
  for (const img of images) totalSize += img.buf.length

  const ico = Buffer.alloc(totalSize)

  // ICO header
  ico.writeUInt16LE(0, 0) // reserved
  ico.writeUInt16LE(1, 2) // type: 1 = ICO
  ico.writeUInt16LE(images.length, 4)

  let offset = dataOffset
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const pos = headerSize + i * dirEntrySize
    ico.writeUInt8(img.size < 256 ? img.size : 0, pos) // width
    ico.writeUInt8(img.size < 256 ? img.size : 0, pos + 1) // height
    ico.writeUInt8(0, pos + 2) // color palette
    ico.writeUInt8(0, pos + 3) // reserved
    ico.writeUInt16LE(1, pos + 4) // color planes
    ico.writeUInt16LE(32, pos + 6) // bits per pixel
    ico.writeUInt32LE(img.buf.length, pos + 8) // size
    ico.writeUInt32LE(offset, pos + 12) // offset
    img.buf.copy(ico, offset)
    offset += img.buf.length
  }

  return ico
}

const ico = buildIco(icoBuffers)
writeFileSync(join(publicDir, 'favicon.ico'), ico)
console.log('✓ favicon.ico (16x16, 32x32, 48x48)')

console.log(
  '\nDone! Update manifest.json and __root.tsx to reference new icons.',
)
