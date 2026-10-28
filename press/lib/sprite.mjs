// Raster sprites: the portrait (frames pulled off the site's shader, see
// tools/capture-portrait.mjs) and the site's 16-frame object strips. Frames
// are stacked into one indexed PNG strip and played with CSS steps().
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"

import { dataUri, encodePng } from "./png.mjs"

const assets = new URL("../assets/", import.meta.url)

let portrait
/** The captured portrait: { cols, rows, sequences: { name: { fps, frames: Uint8Array[] } } }. */
export function loadPortrait() {
  if (portrait) return portrait
  const raw = JSON.parse(readFileSync(new URL("portrait.json", assets), "utf8"))
  portrait = {
    cols: raw.cols,
    rows: raw.rows,
    sequences: Object.fromEntries(
      Object.entries(raw.sequences).map(([k, v]) => [
        k,
        { fps: v.fps, frames: v.frames.map((f) => new Uint8Array(inflateSync(Buffer.from(f, "base64")))) },
      ])
    ),
  }
  return portrait
}

/**
 * Frames (cells 0 paper, 1 shadow, 2 ink) as one vertical PNG strip.
 * `palette` maps each cell value to "#rrggbb" or null (transparent).
 * `map` can rewrite a cell value first, e.g. to print only the ink.
 */
export function strip(frames, cols, rows, palette, map) {
  const px = new Uint8Array(cols * rows * frames.length)
  frames.forEach((f, i) => {
    if (map) for (let k = 0; k < f.length; k++) px[i * cols * rows + k] = map(f[k])
    else px.set(f, i * cols * rows)
  })
  return dataUri(encodePng(cols, rows * frames.length, px, palette))
}

/** A 16-frame object strip from the site (public/objects/*.png), white on clear. */
export function objectStrip(name) {
  return readFileSync(new URL(`objects/${name}.png`, assets))
}

/**
 * The window a strip plays in: a nested <svg> clips to one frame, and the
 * <image> inside is moved by the sheet's CSS (class `cls`). `cell` scales
 * one sprite pixel to user units; `pixelated` keeps the dots square.
 */
export function spriteWindow({ x, y, cols, rows, count, href, cell = 2, cls = "", id }) {
  const w = cols * cell
  const h = rows * cell
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden"${id ? ` id="${id}"` : ""}><image class="${cls}" width="${w}" height="${h * count}" preserveAspectRatio="none" href="${href}" image-rendering="pixelated" style="image-rendering:pixelated"/></svg>`
}
