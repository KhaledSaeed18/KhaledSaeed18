// Figure 1: the stack drawn as an electronic part, from the site's datasheet
// (components/home/pinout.tsx), in the package a part this size comes in: a
// quad flat package, one pin per tool, a quarter of them down each side.
// Numbered as a real QFP is, counter-clockwise in the top view: pin 1 at the
// top of the left side, down the left, left to right along the bottom, up
// the right and back right to left along the top. Each layer takes the next
// run of pins, so a layer can turn a corner. The pin-1 corner of the body is
// cut at 45 degrees, and a square dot sits inside it.
//
// Leads: one dither per layer on the site's 4x4 Bayer lattice, terracotta at
// level max(4, 16 - 2g), then the teal plate at 16 and 8. Each lead is cut
// once per tone and printed with <use>, mirrored or turned to its side, so
// every lead of a layer prints the same dots from the body edge out.
//
// Shown at width 100% in the README: 1:1 in the 846 px column, about 0.68x
// at 578, 0.36x on a phone. On a phone the labels and pin numbers would be
// 4 px tall, so they go: the package keeps its leads, on a coarser lattice,
// and the legend grows so the layers still read. The alt text carries every
// item.
import { cells } from "../lib/dither.mjs"
import { kMark } from "../lib/mark.mjs"
import { part as partOf } from "../lib/part.mjs"
import { cropMarks, doc, rect } from "../lib/sheet.mjs"
import { metrics } from "../lib/type.mjs"
import { typeCase } from "./_chip-case.mjs"

const W = 846
const TRIM = 12 // transparent pasteboard round the sheet, as on the other full-width sheets
const EDGE = 48 // the house column: the rules set their labels from 48 to W - 48
const PAD = 24 // paper round the figure

// The package in each layout. pitch is the most it gets (tighter if the
// labels need the room); end is the body beyond a side's first and last pin
// centres; lead is [length out of the body, width across]; dot is the pin-1
// dot's [inset from the corner, size].
const DESK = { pitch: 19, end: 26, lead: [24, 8], cell: 2, chamfer: 16, dot: [30, 6], stroke: 1 } // 3 x 1 tiles of 2-unit dots
const PHONE = { pitch: 15, end: 21, lead: [32, 8], cell: 4, chamfer: 14, dot: [26, 10], stroke: 3 } // 2 x 1/2 tiles, ~1.5 px dots

const LABEL = 14 // pin labels, Geist: the most they get, never under 12
const GAP = 6 // lead end to label
const NUM = 9 // pin numbers, mono
const NUM_IN = 7 // pin numbers in from the body edge
const SMALL = 12 // legend, caption and markings, mono
const COLS = 4 // desktop legend columns, at most
const ROW = 24 // desktop legend row pitch
const BIG = 30 // the phone legend, mono: about 11 px at 0.36x
const BIG_ROW = 42
const SWATCH = { d: 12, m: 32 } // the phone swatch is 2 x 2 tiles of its 4-unit dots
const TERRA = 6 // layers on the terracotta plate; the rest go on the teal

const n = (v) => +(+v).toFixed(2)

/** An opaque mix of `a` over `b` at `t`: a 50% outline that never doubles up where lines meet. */
function mix(a, b, t) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [rgb(a), rgb(b)]
  return `#${x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("")}`
}

/** Layer g's ink and dither level. */
const toneOf = (g, s) =>
  g < TERRA
    ? { color: s.brand, level: Math.max(4, 16 - 2 * g) }
    : { color: s.teal, level: Math.max(4, 16 - 8 * (g - TERRA)) }

/**
 * The sheet's dither, the site's 4x4 Bayer lattice: a pattern per ink, level
 * and cell size. Level 16 is solid ink, no pattern needed.
 */
function lattice() {
  const inks = []
  const used = new Map()
  const paint = ({ level, color }, cell) => {
    if (level >= 16) return color
    if (!inks.includes(color)) inks.push(color)
    const id = `p${inks.indexOf(color)}-${level}-${cell}`
    used.set(id, { level, cell, color })
    return `url(#${id})`
  }
  paint.defs = () =>
    [...used]
      .map(([id, { level, cell, color }]) => {
        const d = cells(level)
          .map(([x, y]) => `M${x * cell} ${y * cell}h${cell}v${cell}h-${cell}z`)
          .join("")
        return `<pattern id="${id}" width="${cell * 4}" height="${cell * 4}" patternUnits="userSpaceOnUse"><path d="${d}" fill="${color}"/></pattern>`
      })
      .join("")
  return paint
}

/**
 * A layout's package: the body's square at x, y and where its pins sit.
 * Side k of the pins (0 left, 1 bottom, 2 right, 3 top) runs from the
 * corner the numbering turns at; `pin(i)` gives the side and the pin's
 * centre on that side's edge.
 */
function packageAt(L, side, x, y) {
  const size = (side - 1) * L.pitch + 2 * L.end
  const g = { ...L, side, x, y, size, x1: x + size, y1: y + size }
  g.pin = (i) => {
    const k = Math.floor(i / side)
    const a = L.end + (i % side) * L.pitch
    // left: down from the top; bottom: left to right; right: up; top: right to left
    const at = [
      [x, y + a],
      [x + a, y + size],
      [x + size, y + size - a],
      [x + size - a, y],
    ][k]
    return { k, x: at[0], y: at[1] }
  }
  return g
}

/** The body: one outline with the pin-1 corner cut at 45 degrees, and the pin-1 dot. */
function drawBody(G, s, outline) {
  const h = G.stroke / 2
  const [x0, y0, x1, y1, c] = [G.x + h, G.y + h, G.x1 - h, G.y1 - h, G.chamfer]
  const [inset, dot] = G.dot
  return (
    `<path d="M${n(x0 + c)} ${n(y0)}H${n(x1)}V${n(y1)}H${n(x0)}V${n(y0 + c)}Z" fill="${s.card}" stroke="${outline}" stroke-width="${G.stroke}"/>` +
    rect(G.x + inset, G.y + inset, dot, dot, { fill: s.brand, "shape-rendering": "crispEdges" })
  )
}

/**
 * The leads. One cut per tone, a lead pointing right out of the body edge;
 * the right side prints it as is, the left mirrored, the top and bottom
 * turned, so its lattice always starts at the body.
 */
function leads(G, pins, fillOf, key) {
  const [len, wid] = G.lead
  const cut = new Map()
  const sides = [[], [], [], []]
  pins.forEach((p, i) => {
    const fill = fillOf(p)
    if (!cut.has(fill)) cut.set(fill, `${key}${cut.size}`)
    const { k, x, y } = G.pin(i)
    // each side's coordinates in its own frame (see the groups below)
    const [ux, uy] = [
      [G.x1, y - wid / 2], // mirrored about the body's centre
      [G.y1, -(x + wid / 2)], // rotate(90): (u, v) prints at (-v, u)
      [G.x1, y - wid / 2],
      [-G.y, x - wid / 2], // rotate(-90): (u, v) prints at (v, -u)
    ][k]
    sides[k].push(`<use href="#${cut.get(fill)}" x="${n(ux)}" y="${n(uy)}"/>`)
  })
  return {
    defs: [...cut].map(([fill, id]) => `<rect id="${id}" width="${len}" height="${wid}" fill="${fill}"/>`).join(""),
    body:
      `<g shape-rendering="crispEdges">` +
      `<g transform="matrix(-1 0 0 1 ${G.x + G.x1} 0)">${sides[0].join("")}</g>` +
      `<g transform="rotate(90)">${sides[1].join("")}</g>` +
      sides[2].join("") +
      `<g transform="rotate(-90)">${sides[3].join("")}</g>` +
      `</g>`,
  }
}

/**
 * Type round the package. `at(p, k, x, y)` returns [str, x, y, anchor] for a
 * pin; the top and bottom sides are set turned -90 degrees, reading bottom
 * to top, so their items are in the turned frame, where (u, v) prints at
 * (v, -u). Grouped by fill so each ink is one block.
 */
function around(G, pins, t, { face, size, fillOf, at }) {
  const flat = new Map()
  const turned = new Map()
  const add = (m, fill, item) => (m.get(fill) ?? m.set(fill, []).get(fill)).push(item)
  pins.forEach((p, i) => {
    const { k, x, y } = G.pin(i)
    add(k % 2 ? turned : flat, fillOf(p), at(p, k, x, y))
  })
  const blocks = (m) => [...m].map(([fill, items]) => t.block({ face, size, fill }, items)).join("")
  return blocks(flat) + `<g transform="rotate(-90)">${blocks(turned)}</g>`
}

export default function print({ content, stocks, themes, clock }) {
  const layers = content.stack
  const P = partOf(layers)
  const { pins, side, total, ranges } = P
  const digits = Math.max(2, String(total).length)
  const pad = (v) => String(v).padStart(digits, "0")
  const nameOf = (p) => p.name ?? "nc"
  const cap = (face, size) => metrics(face, size).capHeight

  // ---- desktop plan: the widest label on each side sets the room ----
  const t0 = typeCase()
  const widest = (k, size) =>
    Math.max(...pins.slice(k * side, (k + 1) * side).map((p) => t0.width(nameOf(p), { face: "body", size })))
  const reach = DESK.lead[0] + GAP // body edge to label
  // the corner keeps clear of the pin numbers: three digits need a longer end
  const end = Math.max(DESK.end, Math.ceil(NUM_IN + t0.width(pad(total), { face: "mono", size: NUM }) + 8))
  let label = LABEL
  let pitch = DESK.pitch
  let wide
  for (; ; label--) {
    wide = [0, 1, 2, 3].map((k) => widest(k, label))
    const room = W - 2 * (TRIM + PAD) - wide[0] - wide[2] - 2 * reach - 2 * end
    pitch = Math.min(DESK.pitch, Math.floor(room / (side - 1)))
    if (pitch >= label + 4 || label <= 8) break
  }
  const D = { ...DESK, pitch, end, dot: [end + 4, DESK.dot[1]] } // the dot sits just inside the first pin
  const sizeD = (side - 1) * pitch + 2 * D.end
  // the figure (labels and all) centred across the sheet
  const xD = Math.round((W - (sizeD + 2 * reach + wide[0] + wide[2])) / 2 + reach + wide[0])
  const yD0 = Math.ceil(TRIM + PAD + wide[3] + reach)
  // the legend, four to a row unless the longest entry needs a wider column
  const rangeOf = (g) => `${pad(ranges[g][0])} to ${pad(ranges[g][1])}`
  const entry = Math.max(...layers.map((l, g) => t0.width(`${rangeOf(g)} ${l.layer.toLowerCase()}`, { face: "mono", size: SMALL })))
  let cols = COLS
  while (cols > 1 && SWATCH.d + 8 + entry + 12 > (W - 2 * EDGE) / cols) cols--
  const rows = Math.ceil(layers.length / cols)
  const legendD0 = Math.ceil(yD0 + sizeD + reach + wide[1] + 40) // first legend baseline
  const captionD0 = legendD0 + (rows - 1) * ROW + 34
  const heightD = captionD0 + PAD + TRIM

  // ---- phone plan: the package, then the legend, inside the same sheet ----
  const legendH = (layers.length - 1) * BIG_ROW + SWATCH.m
  const gapM = 48
  const fixedM = 2 * (TRIM + PAD) + gapM + legendH + 2 * PHONE.lead[0] + 2 * PHONE.end
  const pitchM = Math.max(10, Math.min(PHONE.pitch, Math.floor((heightD - fixedM) / (side - 1))))
  const M = { ...PHONE, pitch: pitchM }
  const sizeM = (side - 1) * pitchM + 2 * M.end
  const contentM = sizeM + 2 * M.lead[0] + gapM + legendH
  const H = Math.max(heightD, contentM + 2 * (TRIM + PAD))
  const dy = Math.round((H - heightD) / 2) // the desktop's share of any extra height
  const topM = Math.round(TRIM + (H - 2 * TRIM - contentM) / 2)

  const files = []
  for (const theme of themes) {
    const s = stocks[theme]
    const t = typeCase()
    const dither = lattice()
    const outline = mix(s.muted, s.card, 0.5) // border-muted-foreground/50
    const ncLead = mix(s.muted, s.paper, 0.25) // bg-muted-foreground/25
    const ncType = mix(s.muted, s.paper, 0.5) // text-muted-foreground/50
    const tone = (p) => (p.name ? toneOf(p.group, s) : null)
    const leadFill = (cell) => (p) => (p.name ? dither(tone(p), cell) : ncLead)

    // ================================================== desktop
    const G = packageAt(D, side, xD, yD0 + dy)
    const cx = G.x + G.size / 2
    const cy = G.y + G.size / 2
    const leadsD = leads(G, pins, leadFill(D.cell), "L")

    const capL = cap("body", label)
    const labels = around(G, pins, t, {
      face: "body",
      size: label,
      fillOf: (p) => (p.name ? s.type : ncType),
      at: (p, k, x, y) =>
        [
          [nameOf(p), x - reach, y + capL / 2, "end"], // left: set right to left from the lead
          [nameOf(p), -(y + reach), x + capL / 2, "end"], // bottom: hangs below, reading up to the lead
          [nameOf(p), x + reach, y + capL / 2], // right
          [nameOf(p), -(y - reach), x + capL / 2], // top: reads up from the lead
        ][k],
    })

    const capN = cap("mono", NUM)
    const numbers = around(G, pins, t, {
      face: "mono",
      size: NUM,
      fillOf: () => s.muted,
      at: (p, k, x, y) =>
        [
          [pad(p.n), x + NUM_IN, y + capN / 2],
          [pad(p.n), -(y - NUM_IN), x + capN / 2], // reads up towards the pin
          [pad(p.n), x - NUM_IN, y + capN / 2, "end"],
          [pad(p.n), -(y + NUM_IN), x + capN / 2, "end"], // reads up to the pin
        ][k],
    })

    // markings on the package, one block centred on it: maker, part, line, date code
    const K = 28 // the K's ink runs 22.5 to 77.5 down its 100 unit cell, 30 to 76 across
    const capH = cap("heading", 44)
    const capS = cap("mono", SMALL)
    const markH = 0.55 * K + 16 + capH + 18 + capS + 17
    const top = cy - markH / 2
    const partY = top + 0.55 * K + 16 + capH
    const markings = [
      kMark({ x: n(cx - 0.53 * K), y: n(top - 0.225 * K), size: K, color: s.muted }),
      t.block({ face: "heading", size: 44, tracking: -0.025, fill: s.type }, [[P.name, cx, n(partY), "middle"]]),
      t.block({ face: "mono", size: SMALL, fill: s.muted }, [
        ["full-stack", cx, n(partY + 18 + capS), "middle"],
        [`rev ${content.identity.revised.slice(0, 4)}`, cx, n(partY + 18 + capS + 17), "middle"],
      ]),
    ].join("")

    // legend: each layer's run of pins and its tone, in stack order, row by row
    const colW = (W - 2 * EDGE) / cols
    const legendAt = (g) => [EDGE + (g % cols) * colW, legendD0 + dy + Math.floor(g / cols) * ROW]
    const legend = (at, size, sw, cell, swGap) => {
      const c = cap("mono", size)
      const swatches = layers
        .map((_, g) => {
          const [x, y] = at(g)
          return `<rect width="${sw}" height="${sw}" fill="${dither(toneOf(g, s), cell)}" transform="translate(${n(x)} ${n(Math.round(y - c / 2 - sw / 2))})"/>`
        })
        .join("")
      return [
        `<g shape-rendering="crispEdges">${swatches}</g>`,
        t.block(
          { face: "mono", size, fill: s.muted },
          layers.map((_, g) => [rangeOf(g), at(g)[0] + sw + swGap, at(g)[1]])
        ),
        t.block(
          { face: "mono", size, fill: s.type },
          layers.map((l, g) => [
            l.layer.toLowerCase(),
            at(g)[0] + sw + swGap + t.width(`${rangeOf(g)} `, { face: "mono", size }),
            at(g)[1],
          ])
        ),
      ].join("")
    }
    const caption = `figure 1. pin configuration, ${P.pkg}, top view`
    const captionD = t.block({ face: "mono", size: SMALL, fill: s.muted }, [[caption, EDGE, captionD0 + dy]])

    // ================================================== phone
    const GM = packageAt(M, side, Math.round((W - sizeM) / 2), topM + M.lead[0])
    const cxM = GM.x + GM.size / 2
    const cyM = GM.y + GM.size / 2
    const leadsM = leads(GM, pins, leadFill(M.cell), "M")
    const KM = 44
    const capHM = cap("heading", 64)
    const markM = 0.55 * KM + 22 + capHM
    const partM = [
      kMark({ x: n(cxM - 0.53 * KM), y: n(cyM - markM / 2 - 0.225 * KM), size: KM, color: s.muted }),
      t.block({ face: "heading", size: 64, tracking: -0.025, fill: s.type }, [[P.name, cxM, n(cyM + markM / 2), "middle"]]),
    ].join("")
    const bigW =
      SWATCH.m + 16 + Math.max(...layers.map((l, g) => t.width(`${rangeOf(g)} ${l.layer.toLowerCase()}`, { face: "mono", size: BIG })))
    const xM = Math.round((W - bigW) / 2)
    const y0M = GM.y1 + M.lead[0] + gapM + SWATCH.m / 2 + cap("mono", BIG) / 2
    const legendM = legend((g) => [xM, Math.round(y0M + g * BIG_ROW)], BIG, SWATCH.m, M.cell, 16)

    const sheet = [
      rect(TRIM, TRIM, W - 2 * TRIM, H - 2 * TRIM, { fill: s.paper }),
      cropMarks(TRIM, TRIM, W - 2 * TRIM, H - 2 * TRIM, { color: s.crop, gap: 2, len: 9 }),
      `<g class="d">${drawBody(G, s, outline)}${leadsD.body}${labels}${numbers}${markings}${legend(legendAt, SMALL, SWATCH.d, D.cell, 8)}${captionD}</g>`,
      `<g class="m">${drawBody(GM, s, outline)}${leadsM.body}${partM}${legendM}</g>`,
    ].join("\n")

    files.push({
      name: `chip-${theme}.svg`,
      body: doc({
        width: W,
        height: H,
        title: `Figure 1. Pin configuration, ${P.name}`,
        desc: `The stack drawn as a ${total}-pin chip, ${P.name}. ${layers.map((l) => `${l.layer}: ${l.items.join(", ")}.`).join(" ")}${P.ncNote ? ` ${P.ncNote}` : ""}`,
        defs: dither.defs() + leadsD.defs + leadsM.defs + t.defs(),
        css: `.m{display:none}@media (max-width:500px){.d{display:none}.m{display:inline}}`,
        body: sheet,
      }),
    })
  }
  return files
}
