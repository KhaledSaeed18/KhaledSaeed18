// The receipt: how this page was printed, itemised, on a 58 mm thermal roll.
// A port of the site's visit receipt (components/receipt/receipt.tsx): one
// line model for the paper and the text, 32 characters across, rows with
// their values set flush right, rules, a gap, a Code 128 barcode that scans
// back to the site, and a bottom edge torn in square teeth. 384 units wide,
// one unit per dot of the printer head; shown at width 320.
//
// The paper and its ink are the same in both pulls (stocks.thermal). What
// changes is the riddle (the bone pull is the sheet held to the light) and a
// faint ink edge that keeps the paper off GitHub's white page. Static.
import { beirut } from "../lib/clock.mjs"
import { bars } from "../lib/code128.mjs"
import { pattern } from "../lib/dither.mjs"
import { doc } from "../lib/sheet.mjs"
import { faces, metrics } from "../lib/type.mjs"

export const W = 384
/** Characters across a 58 mm roll, the site's WIDTH. */
const COLS = 32
/** JetBrains Mono 18: a 10.8 unit advance, so 32 columns run x 19 to 364.6. */
const SIZE = 18
const ADV = 10.8
const X0 = 19
const SITE = "khaledsaeed.tech"
/** Quiet zone either side of the barcode, in modules (the site's QUIET). */
const QUIET = 10
const MODULE = 1.5
/** Line heights in units; the site's LEAD at 384/320. */
const LEAD = { head: 35, row: 24, center: 24, rule: 18, gap: 15, barcode: 72, stamp: 100 }
const TOP = 31
const BOTTOM = 41
/** The torn edge: square teeth 8 units wide, 6 deep. */
const TOOTH = 8
const DEPTH = 6
/** 1 CSS px at width 320: rules and the edge stay on whole pixels. */
const HAIR = 1.2
/** Baseline below a line's middle: halfway between x-height and cap height. */
const BASE = 6
const CAP = metrics("mono", SIZE).capHeight

const r = (v) => +(+v).toFixed(2)
const DASH = r((COLS * ADV) / 97)
const pad = (n, w = 2) => String(n).padStart(w, "0")
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const day = (c) => `${pad(c.day)} ${MONTHS[c.month - 1]}`
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

// ---------------------------------------------------------------- the model

const row = (left, right = "", bold = false) => ({ kind: "row", left, right, bold })
const center = (text, big = false) => ({ kind: "center", text, big })
const rule = (double = false) => ({ kind: "rule", double })
const gap = () => ({ kind: "gap" })
const barcode = () => ({ kind: "barcode" })
/** The cancel stamp: a band of its own on the paper, two lines in the text. */
const stamp = (word, note) => ({ kind: "stamp", word, note })

/** The riddle the masthead's watermark sets; bone stock has already solved it. */
const RIDDLE = {
  dark: ["the masthead has a watermark.", "hold it to the light."],
  light: ["you held it to the light.", "pull 2 of 2, bone stock."],
}

/** The receipt, line by line: one model for the paper and receipt.txt. */
export function compose({ clock, night, edition, printing, data }, theme) {
  const stale = !data || !!data.stale
  const count = data && Number.isFinite(data.contributions) ? thousands(data.contributions) : "uncounted"
  const lines = [
    center("KHALEDSAEED18", true),
    center("the press room, beirut"),
    rule(),
    // a local build has no run number: the site prints those as proofs
    row(printing ? `printing no. ${pad(printing, 4)}` : "proof copy", `${day(clock)} ${clock.year}`),
    row(`pulled ${clock.clock}`, edition ? `ed. ${edition.slice(0, 7)}` : "ed. local"),
    row("the press", night ? "stopped" : "running"),
    ...(night ? [center("the printer is asleep"), center("until 07:00.")] : []),
    rule(),
    row("THIS PAGE", "QTY", true),
    row("sheets", "5"),
    row("plates", "5"),
    row("tones", "17"),
    row("rounded corners", "0"),
    row("em dashes", "0"),
    row("emoji", "0"),
    rule(),
    row("SET IN", "", "left"),
    row("  hanken grotesk", "titles"),
    row("  geist", "pins"),
    row("  jetbrains mono", "labels"),
    row("  github's own type", "the words"),
    row("DITHER", "bayer 4x4", "left"),
    row("  dot", "2 px, square"),
    row("PULLED BY", "github actions", "left"),
    row("EVERY", "hour, 07:00 to 01:00", "left"),
    rule(),
    row("IMPRESSIONS, 365 DAYS", count, true),
    row("  printed by github, below"),
    ...(stale
      ? [stamp("REPRINT", data?.fetched ? `data from ${day(beirut(new Date(data.fetched)))}, ${beirut(new Date(data.fetched)).clock}` : "no data from github")]
      : []),
    rule(),
    center(RIDDLE[theme][0]),
    center(RIDDLE[theme][1]),
    rule(true),
    row("TOTAL", "5 SHEETS", true),
    row("PAID IN", "ATTENTION", true),
    rule(true),
    barcode(),
    center(SITE),
    gap(),
    center("thank you for reading."),
    center("keep this receipt. no refunds."),
  ]
  return lines
}

/** One line as 32 columns. Throws rather than cut a value short. */
export function columns(l) {
  const mid = (s) => " ".repeat(Math.max(0, Math.floor((COLS - s.length) / 2))) + s
  switch (l.kind) {
    case "row": {
      const room = COLS - l.left.length - l.right.length
      if (room < (l.right ? 1 : 0)) throw new Error(`receipt: "${l.left}" / "${l.right}" is wider than ${COLS} columns`)
      return l.left + (l.right ? " ".repeat(room) + l.right : "")
    }
    case "center":
      if (l.text.length > COLS) throw new Error(`receipt: "${l.text}" is wider than ${COLS} columns`)
      return mid(l.text)
    case "rule":
      return (l.double ? "=" : "-").repeat(COLS)
    case "gap":
      return ""
    case "barcode":
      return mid("|| ||| | |||| || | ||| || |")
    case "stamp":
      return [mid(`[ ${l.word.toLowerCase()} ]`), mid(l.note)].join("\n")
  }
}

/** The receipt as plain text, 32 columns, as the site copies it. */
export const asText = (lines) => `${lines.map(columns).join("\n")}\n`

// ---------------------------------------------------------------- the type

/** A compact path: absolute commands, one decimal, no redundant separators. */
function pathData(commands) {
  let d = ""
  let last = "" // the number just written, if the path ends in one
  const num = (v) => {
    const s = String(+v.toFixed(1)).replace(/^(-?)0\./, "$1.")
    // a minus, or a point after a number that already has one, separates itself
    const sep = !last || s[0] === "-" || (s[0] === "." && last.includes(".")) ? "" : " "
    last = s
    return sep + s
  }
  for (const c of commands) {
    last = ""
    if (c.type === "Z") {
      d += "Z"
      continue
    }
    d += c.type
    const pts = c.type === "C" ? [c.x1, c.y1, c.x2, c.y2, c.x, c.y] : c.type === "Q" ? [c.x1, c.y1, c.x, c.y] : [c.x, c.y]
    for (const p of pts) d += num(p)
  }
  return d
}

/**
 * The printer's type case. A thermal head prints a fixed grid, so each
 * glyph is cut once at 18 units and every letter on the roll is a <use> at
 * a column of its line; bigger type scales the whole line.
 */
function typeCase(prefix = "c") {
  const font = faces.mono
  const cut = new Map()
  const glyph = (ch) => {
    if (!cut.has(ch)) {
      const d = pathData(font.charToGlyph(ch).getPath(0, 0, SIZE).commands)
      cut.set(ch, d ? { id: `${prefix}${cut.size.toString(36)}`, d } : null)
    }
    return cut.get(ch)?.id
  }
  /** `str` on the grid from x, baseline y; `pitch` is the advance in units. */
  const set = (str, { x, y, scale = 1, pitch = ADV, id } = {}) => {
    let uses = ""
    ;[...str].forEach((ch, i) => {
      const g = ch === " " ? null : glyph(ch)
      if (g) uses += `<use href="#${g}"${i ? ` x="${r(i * pitch)}"` : ""}/>`
    })
    if (!uses) return ""
    const at = `translate(${r(x)} ${r(y)})${scale === 1 ? "" : ` scale(${r(scale)})`}`
    return `<g${id ? ` id="${id}"` : ""} transform="${at}">${uses}</g>`
  }
  set.defs = () =>
    [...cut.values()]
      .filter(Boolean)
      .map(({ id, d }) => `<path id="${id}" d="${d}"/>`)
      .join("")
  return set
}

// ---------------------------------------------------------------- the paper

/** The paper's outline, its foot torn in square teeth, half a notch each side. */
function paperPath(h) {
  const foot = h - DEPTH
  let d = `M0 0H${W}V${foot}H${W - TOOTH / 2}`
  let x = W - TOOTH / 2
  for (let k = 0; x > TOOTH; k++) {
    d += k % 2 ? `V${foot}H${(x -= TOOTH)}` : `V${h}H${(x -= TOOTH)}`
  }
  return `${d}V${foot}H0Z`
}

/** What the receipt says, for anyone who opens the file itself. */
function describe({ clock, night, edition, printing, data }) {
  const count = data && Number.isFinite(data.contributions) ? `${thousands(data.contributions)} contributions in the last year` : "no contribution count this run"
  return [
    `A thermal receipt for this page, ${printing ? `printing no. ${printing}` : "a proof copy"}${edition ? `, edition ${edition.slice(0, 7)}` : ""}, pulled ${clock.clock} on ${clock.date} in Beirut${night ? " while the press sleeps" : ""}.`,
    "Five sheets, five plates and seventeen tones, set in Hanken Grotesk, Geist and JetBrains Mono, dithered on a 4x4 Bayer lattice, pulled every hour by GitHub Actions.",
    `${count}${!data || data.stale ? ", stamped reprint" : ""}.`,
    `Total five sheets, paid in attention, with a Code 128 barcode for ${SITE}.`,
  ].join(" ")
}

/** Height of a line in units, as it feeds. */
const lineHeight = (l) => (l.kind === "center" && l.big ? LEAD.head : LEAD[l.kind])

export default function print(ctx) {
  const { stocks, themes } = ctx
  const ink = stocks.dark.thermal.ink
  const sheet = stocks.dark.thermal.paper
  const stale = !ctx.data || !!ctx.data.stale
  const files = [{ name: "receipt.txt", body: asText(compose(ctx, "dark")) }]

  for (const theme of themes) {
    const s = stocks[theme]
    const lines = compose(ctx, theme)
    const t = typeCase()
    const H = TOP + lines.reduce((h, l) => h + lineHeight(l), 0) + BOTTOM
    let y = TOP
    let n = 0
    const type = []
    const strokes = []
    const marks = []
    const struck = (str, opts) => {
      const id = `l${(n++).toString(36)}`
      const g = t(str, { ...opts, id })
      return g ? `${g}<use href="#${id}" x="0.5"/>` : ""
    }

    for (const l of lines) {
      const h = lineHeight(l)
      const mid = y + h / 2
      if (l.kind === "row") {
        const cols = columns(l)
        const base = r(mid + BASE)
        if (l.bold === true) type.push(struck(cols, { x: X0, y: base }))
        else if (l.bold === "left") {
          type.push(struck(l.left, { x: X0, y: base }))
          type.push(t(cols.slice(l.left.length), { x: X0 + l.left.length * ADV, y: base }))
        } else type.push(t(cols, { x: X0, y: base }))
      } else if (l.kind === "center") {
        if (l.big) {
          // the store's name, double struck, a third larger and tracked
          const scale = 4 / 3
          const pitch = ADV + 0.1 * SIZE
          const width = (l.text.length * pitch - 0.1 * SIZE) * scale
          type.push(struck(l.text, { x: W / 2 - width / 2, y: r(mid + (CAP * scale) / 2), scale, pitch }))
        } else {
          // centred by the head, to the dot, as ESC a 1 does
          type.push(t(l.text, { x: r(W / 2 - (l.text.length * ADV) / 2), y: r(mid + BASE) }))
        }
      } else if (l.kind === "rule") {
        const x2 = r(X0 + COLS * ADV)
        if (l.double)
          for (const dy of [-2.4, 2.4])
            strokes.push(`<path d="M${X0} ${r(Math.round((mid + dy) / HAIR) * HAIR)}H${x2}"/>`)
        // 49 dashes and 48 gaps, so the rule starts and ends on ink with the type
        else strokes.push(`<path d="M${X0} ${r(Math.round(mid / HAIR) * HAIR)}H${x2}" stroke-dasharray="${DASH} ${DASH}"/>`)
      } else if (l.kind === "barcode") {
        const code = bars(SITE, { x: X0 + QUIET * MODULE, y: r(y + (h - 56) / 2), height: 56, module: MODULE, fill: ink })
        // geometric edges: each bar keeps its true width, which is what a scanner reads
        marks.push(code.svg.replace(' shape-rendering="crispEdges"', ""))
      } else if (l.kind === "stamp") {
        marks.unshift(cancel(t, { word: l.word, note: l.note, cy: mid, color: s.brand }))
      }
      y += h
    }

    const paper = paperPath(H)
    const body = [
      `<path d="${paper}" fill="${sheet}" shape-rendering="crispEdges"/>`,
      // a hairline of ink just inside the edge (half the stroke, clipped), so
      // the roll holds its shape on GitHub's white page; on the dark page the
      // paper needs no help, and the same element prints clear
      `<path d="${paper}" fill="none" stroke="${ink}" stroke-width="${HAIR * 2}" stroke-opacity="${theme === "light" ? 0.18 : 0}" clip-path="url(#p)" shape-rendering="crispEdges"/>`,
      marks.join(""),
      `<g stroke="${ink}" stroke-width="${HAIR}" fill="none" shape-rendering="crispEdges">${strokes.join("")}</g>`,
      `<g fill="${ink}">${type.join("")}</g>`,
    ].join("")

    files.push({
      name: `receipt-${theme}.svg`,
      body: doc({
        width: W,
        height: r(H),
        title: "the receipt",
        desc: describe(ctx),
        defs: [
          `<clipPath id="p"><path d="${paper}"/></clipPath>`,
          // the stamp's ink, broken by the lattice at 2 CSS px a dot (2.4 units at width 320)
          stale ? `${pattern("s", 13, { cell: 2.4, color: "#fff" })}<mask id="m"><rect width="${W}" height="${r(H)}" fill="url(#s)"/></mask>` : "",
          t.defs(),
        ].join(""),
        body,
      }),
    })
  }
  return files
}

/**
 * The cancel stamp, after the site's proof stamp (components/keys/mark-up.tsx):
 * a double frame in brand ink, the word tracked wide over a rule and a small
 * line, pressed at a slant under the figure it cancels, its ink broken by the
 * Bayer lattice. The lattice stays square to the paper while the stamp turns,
 * so its dots land on whole pixels at width 320.
 */
function cancel(t, { word, note, cy, color }) {
  const wordScale = 28 / SIZE
  const wordPitch = ADV + 0.25 * SIZE
  const wordW = (word.length * wordPitch - 0.25 * SIZE) * wordScale
  const noteScale = 16 / SIZE
  const noteW = note.length * ADV * noteScale
  const padX = 18
  const w = Math.max(wordW, noteW) + padX * 2
  const h = 76
  const cx = W / 2
  const x = -w / 2
  const yy = -h / 2
  const frame = [
    `<rect x="${r(x + 1.5)}" y="${r(yy + 1.5)}" width="${r(w - 3)}" height="${r(h - 3)}" stroke-width="3"/>`,
    `<rect x="${r(x - 3.75)}" y="${r(yy - 3.75)}" width="${r(w + 7.5)}" height="${r(h + 7.5)}" stroke-width="1.5"/>`,
    `<path d="M${r(x + 3)} ${r(yy + 46)}H${r(-x - 3)}" stroke-width="1.5"/>`,
  ].join("")
  const ids = ["sw", "sn"]
  const wordG = t(word, { x: -wordW / 2, y: r(yy + 37), scale: wordScale, pitch: wordPitch, id: ids[0] })
  const noteG = t(note, { x: -noteW / 2, y: r(yy + 64), scale: noteScale, id: ids[1] })
  return `<g mask="url(#m)"><g transform="translate(${cx} ${r(cy)}) rotate(-5)"><g fill="none" stroke="${color}">${frame}</g><g fill="${color}">${wordG}<use href="#sw" x="0.6"/>${noteG}<use href="#sn" x="0.4"/></g></g></g>`
}
