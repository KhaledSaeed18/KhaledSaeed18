// The chip's type case. Same faces, kerning and tracking as lib/type.mjs,
// set three levels deep so a figure with a hundred labels stays small:
//
//   glyph  each outline cut once, on a 250 unit em, as compact relative path data
//   run    each string set once, as a <g> of glyph <use>s at pen offsets
//   block  every run of one face, size and ink placed in one scaled <g>
//
// A run is size-free, so one string printed at two sizes (a legend row on
// the desktop and on the phone) is set only once.
import { faces } from "../lib/type.mjs"

const EM = 1000 // every face in press/fonts is cut on a 1000 unit em
const GRID = 4 // outlines and pen positions on a 250 unit em: 0.12 px at 30 px, invisible
const UNIT = EM / GRID
const r2 = (v) => Math.round(v * 100) / 100

/** Short ids: single letters, then pairs. No t or d: doc() gives those to <title> and <desc>. */
const LETTERS = "abcefghijklmnopqrsuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const name = (i) => (i < LETTERS.length ? LETTERS[i] : name(Math.floor(i / LETTERS.length) - 1) + LETTERS[i % LETTERS.length])

/** Path commands as short relative data: integer units, h/v where it can, no zero-length lines. */
function compact(commands) {
  let out = ""
  let last = ""
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const R = (v) => Math.round(v / GRID)
  const nums = (...v) => {
    let s = ""
    for (const n of v) {
      const t = String(n)
      s += s && !t.startsWith("-") ? ` ${t}` : t
    }
    return s
  }
  const emit = (cmd, ...v) => {
    const body = nums(...v)
    // a repeated command letter can be left out (not after a moveto, which implies l)
    if (cmd === last && cmd !== "m") out += body.startsWith("-") ? body : ` ${body}`
    else out += cmd + body
    last = cmd
  }
  for (const c of commands) {
    if (c.type === "Z") {
      out += "z"
      last = "z"
      cx = sx
      cy = sy
      continue
    }
    const x = R(c.x)
    const y = R(c.y)
    if (c.type === "M") {
      emit("m", x - cx, y - cy)
      sx = x
      sy = y
    } else if (c.type === "L") {
      if (x === cx && y === cy) continue
      if (y === cy) emit("h", x - cx)
      else if (x === cx) emit("v", y - cy)
      else emit("l", x - cx, y - cy)
    } else if (c.type === "Q") {
      emit("q", R(c.x1) - cx, R(c.y1) - cy, x - cx, y - cy)
    } else if (c.type === "C") {
      emit("c", R(c.x1) - cx, R(c.y1) - cy, R(c.x2) - cx, R(c.y2) - cy, x - cx, y - cy)
    }
    cx = x
    cy = y
  }
  return out
}

export function typeCase(prefix = "") {
  const glyphs = new Map() // face:index -> { id, d }
  const runs = new Map() // face|tracking|str -> { id, width, body }
  const gid = () => `${prefix}${name(glyphs.size)}`
  const rid = () => `${prefix}_${name(runs.size)}`

  /** A string set once in font units, baseline at 0, pen starting at 0. */
  const run = (str, face, tracking = 0) => {
    const key = `${face}|${tracking}|${str}`
    if (runs.has(key)) return runs.get(key)
    const font = faces[face]
    const list = font.stringToGlyphs(str)
    let x = 0
    let body = ""
    for (let i = 0; i < list.length; i++) {
      const g = list[i]
      const k = `${face}:${g.index}`
      if (!glyphs.has(k)) {
        const d = compact(g.getPath(0, 0, EM).commands)
        glyphs.set(k, d ? { id: gid(), d } : null)
      }
      const cut = glyphs.get(k)
      const px = Math.round(x / GRID)
      if (cut) body += `<use href="#${cut.id}"${px ? ` x="${px}"` : ""}/>`
      x += g.advanceWidth ?? 0
      if (i < list.length - 1) x += font.getKerningValue(g, list[i + 1]) + tracking * EM
    }
    const r = { id: rid(), width: x / GRID, body }
    runs.set(key, r)
    return r
  }

  /** Width in sheet units. */
  const width = (str, { face = "body", size = 16, tracking = 0 } = {}) => (run(str, face, tracking).width * size) / UNIT

  /**
   * One face, size and ink: items are [str, x, y, anchor?] in sheet units.
   * Extra attributes (class) go on the group.
   */
  const block = ({ face = "body", size = 16, tracking = 0, fill = "currentColor", ...attrs }, items) => {
    const s = size / UNIT
    const uses = items
      .map(([str, x, y, anchor = "start"]) => {
        const r = run(str, face, tracking)
        const x0 = anchor === "middle" ? x - (r.width * s) / 2 : anchor === "end" ? x - r.width * s : x
        return `<use href="#${r.id}" x="${Math.round(x0 / s)}" y="${Math.round(y / s)}"/>`
      })
      .join("")
    const extra = Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join("")
    return `<g fill="${fill}" transform="scale(${r2(s * 1e4) / 1e4})"${extra}>${uses}</g>`
  }

  /** Glyph cuts, then runs, for <defs>. */
  const defs = () =>
    [...glyphs.values()]
      .filter(Boolean)
      .map(({ id, d }) => `<path id="${id}" d="${d}"/>`)
      .join("") + [...runs.values()].map(({ id, body }) => `<g id="${id}">${body}</g>`).join("")

  return { run, width, block, defs }
}
