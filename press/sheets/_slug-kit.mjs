// The slug's own type case and tones: the same faces and the same Bayer
// lattice as press/lib, cut tighter, because a 30 KB strip cannot afford a
// <rect> per dot or a transform per letter.
//
// - Type: each glyph is cut once at 100 units to the em, as a relative path,
//   and each line of type is one <g> scaled to its size, with a bare <use x>
//   per letter.
// - Tones: each Bayer level is one path of 1-unit cells, shared by every
//   colour and lattice; a pattern only scales and inks it. Level 16 is solid
//   ink and level 0 is bare paper, so neither needs a pattern. Each group of
//   the sheet (desktop, phone) gets only the lattices it can be seen at.
import { BAYER } from "../lib/dither.mjs"
import { faces } from "../lib/type.mjs"

const EM = 100 // glyph grid: 0.12 units at mono 12, 0.28 at mono 28
const r2 = (v) => +(+v).toFixed(2)

/** One path command, letters and separators left out wherever SVG allows. */
function join(letter, nums, prev) {
  // a repeated command needs no letter (except m, which would continue as l)
  const implicit = letter === prev && letter !== "m"
  let out = implicit ? "" : letter
  nums.forEach((v, i) => {
    // a minus sign separates on its own; so does the letter before the first number
    out += (i > 0 || implicit) && v >= 0 ? ` ${v}` : `${v}`
  })
  return out
}

/** A glyph as relative path data on an EM grid. Rounds absolute points, so nothing drifts. */
function cut(glyph) {
  const cmds = glyph.getPath(0, 0, EM).commands
  let d = ""
  let prev = ""
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const R = Math.round
  for (const c of cmds) {
    if (c.type === "M") {
      const x = R(c.x)
      const y = R(c.y)
      d += join("m", [x - cx, y - cy], prev)
      prev = "m"
      cx = sx = x
      cy = sy = y
    } else if (c.type === "L") {
      const x = R(c.x)
      const y = R(c.y)
      if (x === cx && y === cy) continue
      if (y === cy) (d += join("h", [x - cx], prev)), (prev = "h")
      else if (x === cx) (d += join("v", [y - cy], prev)), (prev = "v")
      else (d += join("l", [x - cx, y - cy], prev)), (prev = "l")
      cx = x
      cy = y
    } else if (c.type === "Q") {
      const x1 = R(c.x1)
      const y1 = R(c.y1)
      const x = R(c.x)
      const y = R(c.y)
      d += join("q", [x1 - cx, y1 - cy, x - cx, y - cy], prev)
      prev = "q"
      cx = x
      cy = y
    } else if (c.type === "C") {
      const p = [R(c.x1), R(c.y1), R(c.x2), R(c.y2), R(c.x), R(c.y)]
      d += join("c", [p[0] - cx, p[1] - cy, p[2] - cx, p[3] - cy, p[4] - cx, p[5] - cy], prev)
      prev = "c"
      cx = p[4]
      cy = p[5]
    } else if (c.type === "Z") {
      d += "z"
      prev = "z"
      cx = sx
      cy = sy
    }
  }
  return d
}

/**
 *   const t = typeCase()
 *   t("press hours", { face: "mono", size: 12, x: 48, y: 116, fill, anchor })
 *   t.defs()
 */
export function typeCase(prefix = "g") {
  const cuts = new Map()
  const set = (str, { x = 0, y = 0, face = "mono", size = 12, anchor = "start", fill = "currentColor" } = {}) => {
    const font = faces[face]
    const glyphs = font.stringToGlyphs(str)
    const upm = font.unitsPerEm
    // pen positions in EM units
    let pen = 0
    const placed = []
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i]
      placed.push({ g, x: pen })
      pen += ((g.advanceWidth ?? 0) * EM) / upm
      if (i < glyphs.length - 1) pen += (font.getKerningValue(g, glyphs[i + 1]) * EM) / upm
    }
    const s = size / EM
    const width = pen * s
    const x0 = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x
    let uses = ""
    for (const { g, x: gx } of placed) {
      const key = `${face}:${g.index}`
      if (!cuts.has(key)) {
        const d = cut(g)
        cuts.set(key, d ? { id: `${prefix}${cuts.size.toString(36)}`, d } : null)
      }
      const c = cuts.get(key)
      if (c) uses += `<use href="#${c.id}"${gx ? ` x="${r2(gx)}"` : ""}/>`
    }
    return uses ? `<g fill="${fill}" transform="translate(${r2(x0)} ${r2(y)}) scale(${r2(s)})">${uses}</g>` : ""
  }
  set.defs = () =>
    [...cuts.values()]
      .filter(Boolean)
      .map(({ id, d }) => `<path id="${id}" d="${d}"/>`)
      .join("")
  return set
}

/**
 * Cells inked at `level` on a 1-unit 4x4 grid, as strokes one unit wide
 * along each row (butt caps, so a stroke is exactly its cells): neighbours
 * in a row share one segment, and a cell costs about half a filled square.
 */
function cellPath(level) {
  let d = ""
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      if (BAYER[y][x] >= level || (x > 0 && BAYER[y][x - 1] < level)) continue
      let run = 1
      while (x + run < 4 && BAYER[y][x + run] < level) run++
      d += `M${x} ${y || ""}.5h${run}`
    }
  return d
}

/**
 * The sheet's tone registry. `lattice(name, tiers)` opens a group of tones
 * seen at the given lattices: tiers is [[maxWidth | null, cell], ...], the
 * first with null as the base. A group returns, for a level and an ink, the
 * attributes to put on a patch: a class for 1..15, a plain fill for 16,
 * null for 0.
 */
export function toneRegistry() {
  const levels = new Set()
  const groups = []
  const lattice = (prefix, tiers) => {
    const used = new Map()
    const fn = (level, color) => {
      if (level <= 0) return null
      if (level >= 16) return { fill: color }
      const key = `${level}|${color}`
      if (!used.has(key)) used.set(key, { level, color, cls: `${prefix}${used.size.toString(36)}` })
      levels.add(level)
      return { class: used.get(key).cls }
    }
    groups.push({ used, tiers })
    return fn
  }
  const defs = () => {
    const base = [...levels].sort((a, b) => a - b).map((k) => `<path id="b${k}" d="${cellPath(k)}"/>`)
    // patterns grouped by ink: the stroke inherits from the group into each tile
    const byInk = new Map()
    for (const { used, tiers } of groups)
      for (const { level, color, cls } of used.values())
        for (const [i, [, cell]] of tiers.entries()) {
          if (!byInk.has(color)) byInk.set(color, "")
          byInk.set(
            color,
            byInk.get(color) +
              `<pattern id="${cls}${i ? `-${i}` : ""}" width="${4 * cell}" height="${4 * cell}" patternUnits="userSpaceOnUse"><use href="#b${level}" transform="scale(${cell})"/></pattern>`
          )
        }
    return base.join("") + [...byInk].map(([color, pats]) => `<g stroke="${color}">${pats}</g>`).join("")
  }
  // every dot is cut square, at every size
  const css = () =>
    "pattern use{shape-rendering:crispEdges}" +
    groups
      .map(({ used, tiers }) => {
        const all = [...used.values()]
        return tiers
          .map(([w], i) => {
            const rules = all.map(({ cls }) => `.${cls}{fill:url(#${cls}${i ? `-${i}` : ""})}`).join("")
            return w ? `@media (max-width:${w}px){${rules}}` : rules
          })
          .join("")
      })
      .join("")
  return { lattice, defs, css }
}

/**
 * Patches: one <rect> per size in <defs>, placed with <use x y>, so the
 * lattice anchors at each patch's own corner and a patch costs one short tag.
 *
 *   const p = patches()
 *   p(x, y, w, h, tone)      // tone from a lattice: { class } | { fill } | null
 *   p.base(xs, y, w, h, fill) // the stock under a row, as one path
 */
export function patcher(prefix = "r") {
  const sizes = new Map()
  const fn = (x, y, w, h, tone) => {
    if (!tone) return ""
    const key = `${r2(w)}x${r2(h)}`
    if (!sizes.has(key)) sizes.set(key, { id: `${prefix}${sizes.size.toString(36)}`, w: r2(w), h: r2(h) })
    const attrs = Object.entries(tone)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join("")
    return `<use href="#${sizes.get(key).id}"${x ? ` x="${r2(x)}"` : ""}${y ? ` y="${r2(y)}"` : ""}${attrs}/>`
  }
  fn.base = (xs, y, w, h, fill) => `<path d="${xs.map((x) => `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}z`).join("")}" fill="${fill}"/>`
  fn.defs = () => [...sizes.values()].map(({ id, w, h }) => `<rect id="${id}" width="${w}" height="${h}"/>`).join("")
  return fn
}
