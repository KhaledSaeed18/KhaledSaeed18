// The masthead's raster plates. The portrait is three inks (clear, shadow,
// dots), so it packs 4 cells to a byte; the ghost plate is one ink and
// packs 8. Frames are stacked in a vertical strip, where deflate finds most
// of each frame in the one before it, and cut into chunks of at most 22
// frames (4092 px) so no single image passes a phone GPU's 4096 px texture
// limit. The chunks sit end to end in one group, which the sheet moves with
// steps(), so to CSS they are still one strip.
import { deflateSync } from "node:zlib"

import { dataUri, decodePng } from "../lib/png.mjs"

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length)
  head.write(type, 4, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])))
  return Buffer.concat([head, data, crc])
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/**
 * An indexed PNG at the smallest bit depth its palette allows. `pixels` are
 * palette indices, row-major; `palette` is "#rrggbb" or null (clear).
 */
export function packedPng(width, height, pixels, palette) {
  const depth = palette.length <= 2 ? 1 : palette.length <= 4 ? 2 : palette.length <= 16 ? 4 : 8
  const per = 8 / depth
  const stride = Math.ceil(width / per)
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1) + 1
    for (let x = 0; x < width; x++) {
      const v = pixels[y * width + x]
      if (v) raw[o + Math.floor(x / per)] |= v << (8 - depth - (x % per) * depth)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = depth
  ihdr[9] = 3
  // tRNS only needs to run as far as the last clear entry
  const lastClear = palette.reduce((k, c, i) => (c ? k : i), -1)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("PLTE", Buffer.from(palette.flatMap((c) => (c ? hex(c) : [0, 0, 0])))),
    ...(lastClear >= 0 ? [chunk("tRNS", Buffer.from(palette.slice(0, lastClear + 1).map((c) => (c ? 255 : 0))))] : []),
    chunk("IDAT", deflateSync(raw, { level: 9, memLevel: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

/**
 * Frames as <image> chunks stacked end to end, `cell` units a cell, for a
 * group the sheet animates. `map` rewrites each cell value first (the ghost
 * plate keeps only the dots).
 */
export function stripImages(frames, { cols, rows, palette, map, cell = 2, per = 22, cls }) {
  const w = cols * cell
  const fh = rows * cell
  let out = ""
  for (let i = 0; i < frames.length; i += per) {
    const run = frames.slice(i, i + per)
    const px = new Uint8Array(cols * rows * run.length)
    run.forEach((f, k) => {
      if (map) for (let j = 0; j < f.length; j++) px[k * cols * rows + j] = map(f[j])
      else px.set(f, k * cols * rows)
    })
    const href = dataUri(packedPng(cols, rows * run.length, px, palette))
    out += `<image${cls ? ` class="${cls}"` : ""} y="${i * fh}" width="${w}" height="${fh * run.length}" preserveAspectRatio="none" href="${href}"/>`
  }
  return out
}

/** The site's 16-frame object strip (white on clear), re-inked in one colour. */
export function objectImage(buf, color) {
  const { width, height, rgba } = decodePng(buf)
  const px = new Uint8Array(width * height)
  for (let i = 0; i < px.length; i++) px[i] = rgba[i * 4 + 3] > 127 ? 1 : 0
  return { width, height, href: dataUri(packedPng(width, height, px, [null, color])) }
}
