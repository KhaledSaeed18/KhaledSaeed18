// Typesetting. Every word in the sheets is set here and printed as outlines,
// so an SVG behind GitHub's image proxy never has to load a font.
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const opentype = require("opentype.js")

const dir = fileURLToPath(new URL("../fonts/", import.meta.url))

/** The site's three faces: headings, body and labels. */
export const faces = {
  heading: opentype.loadSync(`${dir}HankenGrotesk.ttf`), // Hanken Grotesk 500
  body: opentype.loadSync(`${dir}Geist-Regular.ttf`), // Geist 400
  mono: opentype.loadSync(`${dir}JetBrainsMono.ttf`), // JetBrains Mono 400
}

const round = (n) => Math.round(n * 100) / 100

/** Glyphs of `str` with their pen positions, kerned, with optional tracking (em). */
function layout(font, str, size, tracking = 0) {
  const scale = size / font.unitsPerEm
  const glyphs = font.stringToGlyphs(str)
  const out = []
  let x = 0
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i]
    out.push({ g, x })
    x += (g.advanceWidth ?? 0) * scale
    if (i < glyphs.length - 1) {
      x += font.getKerningValue(g, glyphs[i + 1]) * scale
      x += tracking * size
    }
  }
  return { glyphs: out, width: x }
}

/** Width of `str` set in `face` at `size`. */
export function measure(str, { face = "body", size = 16, tracking = 0 } = {}) {
  return layout(faces[face], str, size, tracking).width
}

/**
 * `str` as one <path>. `x`/`y` place the baseline; `anchor` is start, middle
 * or end. Extra attributes (fill, class, opacity) are passed through.
 */
export function text(
  str,
  {
    x = 0,
    y = 0,
    face = "body",
    size = 16,
    tracking = 0,
    anchor = "start",
    fill = "currentColor",
    ...attrs
  } = {}
) {
  const font = faces[face]
  const { glyphs, width } = layout(font, str, size, tracking)
  const x0 = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x
  let d = ""
  for (const { g, x: gx } of glyphs) {
    const p = g.getPath(x0 + gx, y, size)
    d += p.toPathData(2)
  }
  const extra = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("")
  return d ? `<path d="${d}" fill="${fill}"${extra}/>` : ""
}

/**
 * A sheet's type case: every glyph is cut once, in <defs>, and each letter
 * on the sheet is a <use> of it. Far smaller than outlining every letter
 * when a sheet sets a lot of type (labels, the receipt, microprint).
 *
 *   const t = atlas()
 *   t("02 datasheet", { face: "mono", size: 13, x: 48, y: 28, fill })
 *   doc({ defs: t.defs(), ... })
 */
export function atlas(prefix = "g") {
  const cut = new Map()
  const set = (
    str,
    { x = 0, y = 0, face = "body", size = 16, tracking = 0, anchor = "start", fill = "currentColor", ...attrs } = {}
  ) => {
    const font = faces[face]
    const { glyphs, width } = layout(font, str, size, tracking)
    const x0 = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x
    const s = round(size / font.unitsPerEm * 10000) / 10000
    let uses = ""
    for (const { g, x: gx } of glyphs) {
      const key = `${face}:${g.index}`
      if (!cut.has(key)) {
        const d = g.getPath(0, 0, font.unitsPerEm).toPathData(0)
        cut.set(key, d ? { id: `${prefix}${cut.size.toString(36)}`, d } : null)
      }
      const c = cut.get(key)
      if (c) uses += `<use href="#${c.id}" transform="translate(${round(x0 + gx)} ${round(y)}) scale(${s})"/>`
    }
    const extra = Object.entries(attrs)
      .filter(([, v]) => v !== undefined && v !== false)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join("")
    return uses ? `<g fill="${fill}"${extra}>${uses}</g>` : ""
  }
  set.defs = () =>
    [...cut.values()]
      .filter(Boolean)
      .map(({ id, d }) => `<path id="${id}" d="${d}"/>`)
      .join("")
  return set
}

/** Font metrics in px at `size`, for aligning type to rules. */
export function metrics(face, size) {
  const f = faces[face]
  const s = size / f.unitsPerEm
  return {
    ascender: round(f.ascender * s),
    descender: round(f.descender * s),
    capHeight: round((f.tables.os2.sCapHeight ?? f.ascender * 0.7) * s),
    xHeight: round((f.tables.os2.sxHeight ?? f.ascender * 0.5) * s),
  }
}
