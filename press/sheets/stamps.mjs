// The pane of link stamps, and the drawer tabs. Each stamp is the site's
// postcard stamp (components/home/contact-sheet.tsx, .stamp in
// app/globals.css) cut down to 68x84: a perforated frame in the stamp-frame
// colour, a field of card stock with a level-3 tint in the stock's own ink,
// and the site's glyph printed from two plates, the ink over a second plate
// knocked a step out of register. Shown at width 68, always 1:1, eight to a
// row; the gaps between the links are the tear lines.
import { tones } from "../lib/dither.mjs"
import { GLYPHS, glyph } from "../lib/glyphs.mjs"
import { doc } from "../lib/sheet.mjs"
import { faces, measure } from "../lib/type.mjs"

export const W = 68
export const H = 84

const n = (v) => +(+v).toFixed(2)
const pad2 = (i) => String(i).padStart(2, "0")

export const DEFAULTS = {
  frame: 4, // frame width, edge to field
  depth: 2, // how far a perforation notch bites into the frame
  tooth: 2, // tooth width: narrow teeth, wide holes, as the site's dashed outline cuts them
  period: 8, // tooth pitch
  glyph: 32, // glyph size from the 24 grid: 4/3, so the 1.5 strokes print 2 units, one dot
  offset: [1, 1], // second plate, in sheet units
  plateOpacity: 0.9,
  keyline: false,
  halo: 1.5, // the ink knocks the tint out this far round each stroke
  band: true, // the caption on a tablet of clear stock across the foot of the field
  level: 3,
  cornerSize: 8,
  labelSize: 10,
  labelY: 76,
  glyphNudge: 0,
  motion: true,
}

/**
 * Teeth along an edge of `length`: as many as fit at `period`, centred, so
 * the margin at each corner is a whole unit (the corners stay notched).
 */
function teeth(length, { tooth, period, depth }) {
  let best = null
  for (let count = 1; count < 64; count++) {
    const span = (count - 1) * period + tooth
    const margin = (length - span) / 2
    if (margin < depth) break
    if (Number.isInteger(margin)) best = { count, margin }
  }
  if (!best) throw new Error(`no perforation fits ${length}`)
  return Array.from({ length: best.count }, (_, i) => best.margin + i * period)
}

/**
 * A word as one outline. The press's atlas cuts each glyph at the font's
 * 1000 units; a stamp sets a dozen letters at 8 and 9 units, so here they
 * are cut at 100 units to the em (a hundredth of an em is 0.09 units at
 * size 9, well under a dot) with relative commands, which keeps each stamp
 * inside its 6 KB.
 */
function word(str, { x = 0, y = 0, size = 9, anchor = "start", fill = "currentColor", face = "mono" } = {}) {
  const font = faces[face]
  const em = 100
  const glyphs = font.stringToGlyphs(str)
  const width = measure(str, { face, size })
  const x0 = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x
  let d = ""
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let pen = 0
  const num = (v) => {
    const r = Math.round(v)
    return r === 0 ? "0" : String(r)
  }
  const pair = (a, b) => {
    const s1 = num(a)
    const s2 = num(b)
    return s1 + (s2.startsWith("-") ? "" : " ") + s2
  }
  const join = (cmd, parts) => {
    let out = cmd
    parts.forEach((p, i) => (out += i === 0 || p.startsWith("-") ? p : ` ${p}`))
    return out
  }
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i]
    const path = g.getPath(pen, 0, em)
    for (const c of path.commands) {
      const q = (v) => Math.round(v)
      if (c.type === "M") {
        const [X, Y] = [q(c.x), q(c.y)]
        d += join("m", [pair(X - cx, Y - cy)])
        cx = sx = X
        cy = sy = Y
      } else if (c.type === "L") {
        const [X, Y] = [q(c.x), q(c.y)]
        if (X === cx && Y === cy) continue
        if (Y === cy) d += join("h", [num(X - cx)])
        else if (X === cx) d += join("v", [num(Y - cy)])
        else d += join("l", [pair(X - cx, Y - cy)])
        cx = X
        cy = Y
      } else if (c.type === "Q") {
        const [X1, Y1, X, Y] = [q(c.x1), q(c.y1), q(c.x), q(c.y)]
        if (X === cx && Y === cy && X1 === cx && Y1 === cy) continue
        d += join("q", [pair(X1 - cx, Y1 - cy), pair(X - cx, Y - cy)])
        cx = X
        cy = Y
      } else if (c.type === "C") {
        const [X1, Y1, X2, Y2, X, Y] = [q(c.x1), q(c.y1), q(c.x2), q(c.y2), q(c.x), q(c.y)]
        d += join("c", [pair(X1 - cx, Y1 - cy), pair(X2 - cx, Y2 - cy), pair(X - cx, Y - cy)])
        cx = X
        cy = Y
      } else if (c.type === "Z") {
        d += "z"
        cx = sx
        cy = sy
      }
    }
    pen += (g.advanceWidth ?? 0) * (em / font.unitsPerEm)
    if (i < glyphs.length - 1) pen += font.getKerningValue(g, glyphs[i + 1]) * (em / font.unitsPerEm)
  }
  return d ? `<path transform="translate(${n(x0)} ${n(y)}) scale(${n(size / em)})" d="${d}" fill="${fill}"/>` : ""
}

/** The frame: a body inset by the notch depth, plus the teeth round its edge. */
function framePath(o) {
  const { depth: d, tooth: t } = o
  const box = (x, y, w, h) => `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`
  let p = box(d, d, W - 2 * d, H - 2 * d)
  for (const x of teeth(W, o)) p += box(x, 0, t, d) + box(x, H - d, t, d)
  for (const y of teeth(H, o)) p += box(0, y, d, t) + box(W - d, y, d, t)
  return p
}

/**
 * The glyph's strokes and dots as geometry, in sheet units: segments for
 * every stroked path and rect, boxes for the square dots. Parts the site
 * hides at rest are left out.
 */
function strokes(name, { x, y, size }) {
  const s = size / 24
  const P = (gx, gy) => [x + gx * s, y + gy * s]
  const src = GLYPHS[name].replace(/<g class="[^"]*" data-rest="hidden">.*?<\/g>/g, "")
  const segs = []
  const boxes = []
  for (const m of src.matchAll(/<rect([^>]*)\/>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]))
    const [rx, ry, rw, rh] = [+a.x, +a.y, +a.width, +a.height]
    if (a.fill === "currentColor") boxes.push([...P(rx, ry), ...P(rx + rw, ry + rh)])
    else {
      const c = [P(rx, ry), P(rx + rw, ry), P(rx + rw, ry + rh), P(rx, ry + rh)]
      for (let i = 0; i < 4; i++) segs.push([...c[i], ...c[(i + 1) % 4]])
    }
  }
  for (const m of src.matchAll(/<path[^>]* d="([^"]*)"/g)) {
    let cur = null
    let start = null
    for (const [, cmd, args] of m[1].matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
      const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number)
      let next
      if (cmd === "M") {
        cur = start = [v[0], v[1]]
        continue
      }
      if (cmd === "L") next = [v[0], v[1]]
      if (cmd === "H") next = [v[0], cur[1]]
      if (cmd === "V") next = [cur[0], v[0]]
      if (cmd === "Z") next = start
      segs.push([...P(...cur), ...P(...next)])
      cur = next
    }
  }
  return { segs, boxes, half: 0.75 * s }
}

/** Distance from point to segment. */
function toSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * The knockout under the glyph, cut on the dither's own lattice: every
 * 2-unit cell within `clear` of a stroke (or a dot) is left unprinted, so
 * the tint stops in whole dots instead of breaking them. Returned as one
 * path of row runs.
 */
function knockout(name, at, { x0, y0, x1, y1, clear, cell = 2 }) {
  const { segs, boxes, half } = strokes(name, at)
  const reach = half + clear
  const hit = (cx, cy) => {
    // sample the cell's centre and corners against the strokes, square caps
    // allowed for by the reach; dots by box distance
    const pts = [
      [cx + cell / 2, cy + cell / 2],
      [cx, cy],
      [cx + cell, cy],
      [cx, cy + cell],
      [cx + cell, cy + cell],
    ]
    for (const sg of segs) for (const [px, py] of pts) if (toSegment(px, py, sg) < reach) return true
    for (const [bx0, by0, bx1, by1] of boxes) {
      const dx = Math.max(bx0 - (cx + cell), 0, cx - bx1)
      const dy = Math.max(by0 - (cy + cell), 0, cy - by1)
      if (Math.hypot(dx, dy) < clear) return true
    }
    return false
  }
  let d = ""
  for (let cy = y0; cy < y1; cy += cell) {
    let run = null
    for (let cx = x0; cx <= x1; cx += cell) {
      const on = cx < x1 && hit(cx, cy)
      if (on && run === null) run = cx
      if (!on && run !== null) {
        d += `M${run} ${cy}h${cx - run}v${cell}h${run - cx}z`
        run = null
      }
    }
  }
  return d
}

/**
 * The glyph's one move, from app/glyphs.css, played once as the stamp comes
 * off the press: the second plate slips out of register (fade and slide, the
 * site's hover), and the glyph's own part makes its move and settles back.
 * Base styles are the resting print, so reduced motion shows it complete.
 */
const PARTS = {
  mail: [
    [".g-flap", "transform-origin:center top", "transform:scaleY(.35)"],
    [".g-letter", "", "opacity:1;transform:none", "opacity:0;transform:translateY(4px)"],
  ],
  calendar: [
    [".g-rings", "", "transform:translateY(-1px)"],
    [".g-tick", "", "transform:rotate(-10deg) scale(1.15)"],
  ],
  save: [[".g-arrow", "", "transform:translateY(2px)"]],
  linkedin: [[".g-tittle", "", "transform:translateY(-1.75px)"]],
  x: [
    [".g-hair-up", "", "transform:translate(1px,-1px)"],
    [".g-hair-down", "", "transform:translate(-1px,1px)"],
  ],
  devto: [[".g-type", "", "transform:translateY(-1px)"]],
  instagram: [
    [".g-lens", "", "transform:scale(.88)"],
    [".g-aperture", "", "transform:scale(2.2)"],
    [".g-flash", "", "transform:scale(1.5)"],
  ],
  discord: [
    [".g-face", "", "transform:rotate(-8deg)"],
    [".g-eyes", "", "transform:scaleY(.4)"],
  ],
}

function motionCss(name, index, o, scale) {
  if (!o.motion) return ""
  // a hand runs along the pane: each stamp a beat after the one before
  const delay = 0.35 + index * 0.12
  const ease = "cubic-bezier(.22,1,.36,1)"
  // the plate sits inside the glyph's own 24 unit grid
  const [ox, oy] = o.offset.map((v) => v / scale)
  const css = [
    `.gl *{transform-box:fill-box;transform-origin:center}`,
    // the plate starts in register under the ink, then slips to its rest
    `.pl{animation:pl .42s ${delay}s ${ease} backwards}`,
    `@keyframes pl{from{opacity:0;transform:translate(${n(-ox)}px,${n(-oy)}px)}}`,
  ]
  PARTS[name].forEach(([sel, origin, on, rest], i) => {
    const k = `p${i}`
    if (origin) css.push(`.gl ${sel}{${origin}}`)
    // rest -> on -> rest: the site's hover, in and out once
    css.push(`.gl ${sel}{animation:${k} .9s ${n(delay + 0.12)}s ${ease} backwards}`)
    css.push(`@keyframes ${k}{0%,100%{${rest ?? "transform:none"}}45%{${on}}}`)
  })
  return css.join("")
}

/** One stamp, for one pull. */
export function stamp(entry, index, s, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const stock = s.stocks[entry.stock]
  const plate = entry.plate === "teal" ? s.stocks.teal.paper : s.brand
  const tone = tones({ tiers: [] })
  const f = o.frame
  const fw = W - 2 * f
  const fh = H - 2 * f
  const no = pad2(index + 1)

  // knockouts: the tint cleared round a label, as the site's spans do
  // (px-0.5 py-px round a leading-none line)
  const knock = (str, { x, y, size, anchor = "start" }) => {
    const w = measure(str, { face: "mono", size })
    const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x
    // cut on the lattice (even units), so no dot is printed in half
    const even = (v, f) => 2 * f(v / 2)
    const bx = even(x0 - 1.5, Math.floor)
    const bw = even(x0 + w + 1.5, Math.ceil) - bx
    const top = even(y - size + 0.5, Math.floor)
    const bh = even(y + 2, Math.ceil) - top
    return {
      top,
      svg:
        `<rect x="${bx}" y="${top}" width="${bw}" height="${bh}" fill="${stock.paper}"/>` +
        word(str, { size, x: x0, y, fill: stock.ink, anchor: "start" }),
    }
  }
  const cy = f + 4 + o.cornerSize + 0.5
  const lb = knock("lb", { x: f + 4, y: cy, size: o.cornerSize })
  const idx = knock(no, { x: W - f - 4, y: cy, size: o.cornerSize, anchor: "end" })
  let label
  if (o.band) {
    const top = 2 * Math.floor((o.labelY - o.labelSize - 1) / 2)
    label = {
      top,
      svg:
        `<rect x="${f}" y="${top}" width="${fw}" height="${H - f - top}" fill="${stock.paper}"/>` +
        word(entry.label, { size: o.labelSize, x: W / 2, y: o.labelY, fill: stock.ink, anchor: "middle" }),
    }
  } else label = knock(entry.label, { x: W / 2, y: o.labelY, size: o.labelSize, anchor: "middle" })

  // the glyph, centred between the corner labels and the caption, on whole units
  const gs = o.glyph
  const scale = gs / 24
  const gx = Math.round((W - gs) / 2)
  const above = cy + 2
  const gy = Math.round((above + label.top) / 2 - gs / 2 + o.glyphNudge)
  const at = { x: gx, y: gy, size: gs }
  const mark = glyph(entry.glyph, {
    ...at,
    ink: stock.ink,
    plate,
    offset: [o.offset[0] / scale, o.offset[1] / scale],
    plateClass: "pl",
  })
    .replace(`opacity="0.9"`, `opacity="${o.plateOpacity}"`)
    .replace(/^<g /, `<g class="gl" `)
  // the ink plate knocks the tint out under itself, in whole dots
  const halo = o.halo
    ? `<path d="${knockout(entry.glyph, at, { x0: f, y0: f, x1: W - f, y1: H - f, clear: o.halo })}" fill="${stock.paper}"/>`
    : ""

  const body = [
    `<path d="${framePath(o)}" fill="${s.stampFrame}" shape-rendering="crispEdges"/>`,
    `<rect x="${f}" y="${f}" width="${fw}" height="${fh}" fill="${stock.paper}"/>`,
    // the lattice starts at the field's corner, as the site's mask does
    `<g transform="translate(${f} ${f})"><rect width="${fw}" height="${fh}" class="${tone(o.level, stock.ink)}"/></g>`,
    o.keyline
      ? `<rect x="${f + 0.5}" y="${f + 0.5}" width="${fw - 1}" height="${fh - 1}" fill="none" stroke="${stock.ink}" stroke-width="1"/>`
      : "",
    halo,
    mark,
    lb.svg,
    idx.svg,
    label.svg,
  ].join("")

  return doc({
    width: W,
    height: H,
    title: `stamp ${no}, ${entry.label}`,
    desc: `A postage stamp on ${entry.stock} stock: the ${entry.label} glyph over a ${entry.plate} plate, lb ${no}.`,
    defs: tone.defs(),
    css: tone.css() + motionCss(entry.glyph, index, o, scale),
    body,
  })
}

/** A drawer tab: a 12 unit swatch of card stock with its level-3 tint. */
export function tab(name, s) {
  const stock = s.stocks[name]
  const tone = tones({ tiers: [] })
  // the lattice is set in by one unit, so the seven dots sit square in the swatch
  const body = `<rect width="12" height="12" fill="${stock.paper}"/><g transform="translate(1 1)"><rect x="-1" y="-1" width="12" height="12" class="${tone(3, stock.ink)}"/></g>`
  return doc({ width: 12, height: 12, title: `${name} stock`, defs: tone.defs(), css: tone.css(), body })
}

export default function print({ content, stocks, themes }) {
  const files = []
  content.stamps.forEach((entry, i) => {
    for (const theme of themes)
      files.push({ name: `stamp-${pad2(i + 1)}-${entry.key}-${theme}.svg`, body: stamp(entry, i, stocks[theme]) })
  })
  for (const name of ["terracotta", "teal", "stone"]) files.push({ name: `tab-${name}.svg`, body: tab(name, stocks.dark) })
  return files
}
