// A small indexed PNG encoder, so the build needs nothing but Node. Images
// here are a handful of flat inks (a 1-bit portrait, a tone), which an
// 8-bit palette PNG stores in a few hundred bytes a frame.
import { deflateSync, inflateSync } from "node:zlib"

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/**
 * Encode `pixels` (a Uint8Array of palette indices, row-major, `width` x
 * `height`) as a PNG. `palette` is a list of "#rrggbb" or null (transparent).
 */
export function encodePng(width, height, pixels, palette) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 3 // indexed colour
  const plte = Buffer.from(palette.flatMap((c) => (c ? hex(c) : [0, 0, 0])))
  const trns = Buffer.from(palette.map((c) => (c ? 255 : 0)))
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1)
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("tRNS", trns),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

export const dataUri = (buf) => `data:image/png;base64,${buf.toString("base64")}`

/**
 * Decode an 8-bit, non-interlaced PNG (grey, RGB, palette, grey+alpha or
 * RGBA) to { width, height, rgba: Uint8Array }. Enough for the site's
 * object strips, which are then re-inked per stock.
 */
export function decodePng(buf) {
  let p = 8
  let width, height, depth, type, palette, trns
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const kind = buf.toString("ascii", p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (kind === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      depth = data[8]
      type = data[9]
      if (data[12]) throw new Error("interlaced PNG")
    } else if (kind === "PLTE") palette = data
    else if (kind === "tRNS") trns = data
    else if (kind === "IDAT") idat.push(data)
    p += 12 + len
  }
  if (depth !== 8 && !(depth < 8 && (type === 0 || type === 3))) throw new Error(`PNG bit depth ${depth}`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]
  const raw = inflateSync(Buffer.concat(idat))
  // filters work on bytes; sub-byte pixels are unpacked afterwards
  const bpp = Math.max(1, (channels * depth) >> 3)
  const stride = Math.ceil((width * channels * depth) / 8)
  const bytes = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? bytes[y * stride + x - bpp] : 0
      const b = y ? bytes[(y - 1) * stride + x] : 0
      const c = x >= bpp && y ? bytes[(y - 1) * stride + x - bpp] : 0
      const pa = Math.abs(b - c)
      const pb = Math.abs(a - c)
      const pc = Math.abs(a + b - 2 * c)
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]
      bytes[y * stride + x] = (row[x] + pred) & 0xff
    }
  }
  let px = bytes
  if (depth < 8) {
    px = new Uint8Array(width * height)
    const max = (1 << depth) - 1
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const bit = x * depth
        const v = (bytes[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & max
        px[y * width + x] = type === 0 ? Math.round((v * 255) / max) : v
      }
  }
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    if (type === 6) rgba.set(px.subarray(i * 4, i * 4 + 4), o)
    else if (type === 2) rgba.set([px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255], o)
    else if (type === 0) rgba.set([px[i], px[i], px[i], 255], o)
    else if (type === 4) rgba.set([px[i * 2], px[i * 2], px[i * 2], px[i * 2 + 1]], o)
    else {
      const k = px[i]
      rgba.set([palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2], trns && k < trns.length ? trns[k] : 255], o)
    }
  }
  return { width, height, rgba }
}
