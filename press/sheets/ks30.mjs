// Figure 1: the stack drawn as an electronic part. A port of the site's
// components/home/pinout.tsx: a dual in-line package with one pin per tool,
// grouped by layer, numbered down the left side and back up the right the
// way a real DIP is; an odd count gets an "nc" pin so both sides match. Each
// layer's leads are terracotta dither at level max(4, 16 - 2g).
//
// Shown at width 560 in the README: 1:1 on desktop, about 0.55x on a phone.
// There the labels grow, the leads get shorter and stouter on a coarser
// lattice (the site's own phone stubs), and the fine print (pin numbers,
// markings, legend) gives way to the real-text drawer under the image.
import { cells } from "../lib/dither.mjs"
import { kMark } from "../lib/mark.mjs"
import { cropMarks, doc, rect } from "../lib/sheet.mjs"
import { metrics } from "../lib/type.mjs"
import { typeCase } from "./_ks30-case.mjs"

const W = 560
const CX = W / 2
const TRIM = 10 // transparent pasteboard round the sheet
const EDGE = 34 // left edge of the legend and caption; the right edge mirrors it

// the package
const PKG_W = 150
const PKG_X = CX - PKG_W / 2 // 205
const PKG_TOP = 44
const PITCH = 30
const END = 21 // package body beyond the first and last pin centres
const NOTCH = [16, 8] // a half-round notch, cut square
const MAX_PKG = 470 // the tallest the package may grow before the pitch tightens

// leads and labels, per layout: lead [width, height], lattice cell, label size, label gap
const DESK = { lead: [32, 8], cell: 2, label: 16, gap: 10 } // 4 x 1 Bayer tiles
const PHONE = { lead: [24, 12], cell: 3, label: 21, gap: 8 } // 2 x 1 tiles, ~1.65 px dots at 0.55x

const NUM = 9 // pin numbers, mono
const SMALL = 11 // legend, caption, package markings, mono
const CAPTION_M = 20
const LEGEND_PITCH = 22

const n = (v) => +(+v).toFixed(2)
const pad2 = (v) => String(v).padStart(2, "0")

/** An opaque mix of `a` over `b` at `t`: a 50% outline that never doubles up where lines meet. */
function mix(a, b, t) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [rgb(a), rgb(b)]
  return `#${x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("")}`
}

/** Pins in package order, numbered as pinout.tsx numbers them. */
function pinout(layers) {
  const pins = layers.flatMap((l, group) => l.items.map((name) => ({ n: 0, name, group })))
  if (pins.length % 2) pins.push(null)
  pins.forEach((p, i) => p && (p.n = i + 1))
  const total = pins.length
  const half = total / 2
  return {
    total,
    half,
    left: pins.slice(0, half),
    right: pins.slice(half).reverse(), // the right side counts upward from the bottom
    start: layers.map((_, g) => pins.findIndex((p) => p?.group === g) + 1),
  }
}

/**
 * The sheet's dither, the site's 4x4 Bayer lattice: a pattern per level and
 * cell size, cells as one path. Level 16 is solid ink, no pattern needed.
 */
function lattice(color) {
  const used = new Map()
  const paint = (level, cell) => {
    if (level >= 16) return color
    const id = `d${level}-${cell}`
    used.set(id, { level, cell })
    return `url(#${id})`
  }
  paint.defs = () =>
    [...used]
      .map(([id, { level, cell }]) => {
        const d = cells(level)
          .map(([x, y]) => `M${x * cell} ${y * cell}h${cell}v${cell}h-${cell}z`)
          .join("")
        return `<pattern id="${id}" width="${cell * 4}" height="${cell * 4}" patternUnits="userSpaceOnUse"><path d="${d}" fill="${color}"/></pattern>`
      })
      .join("")
  return paint
}

export default function print({ content, stocks, themes, clock }) {
  const layers = content.stack
  const { total, half, left, right, start } = pinout(layers)
  const level = (g) => Math.max(4, 16 - 2 * g)
  const part = `KS-${total}`

  // vertical plan: the package, the legend in rows of three, the caption
  const pitch = Math.min(PITCH, (MAX_PKG - 2 * END) / Math.max(1, half - 1))
  const pkgH = (half - 1) * pitch + 2 * END
  const pkgBottom = PKG_TOP + pkgH
  const pinY = (r) => PKG_TOP + END + r * pitch
  const legendY = pkgBottom + 38 // first legend baseline
  const captionY = legendY + (Math.ceil(layers.length / 3) - 1) * LEGEND_PITCH + 38
  const H = captionY + 26 + TRIM
  const cy = PKG_TOP + pkgH / 2

  const cap = (face) => metrics(face, 1).capHeight
  // a baseline that centres capitals and figures on y
  const mid = (y, face, size) => n(y + (cap(face) * size) / 2)

  const files = []
  for (const theme of themes) {
    const s = stocks[theme]
    const t = typeCase()
    const dither = lattice(s.brand)
    const outline = mix(s.muted, s.card, 0.5) // border-muted-foreground/50
    const ncLead = mix(s.muted, s.paper, 0.25) // bg-muted-foreground/25
    const ncType = mix(s.muted, s.paper, 0.5) // text-muted-foreground/50
    const names = (side) => side.map((p) => (p ? p.name : "nc"))
    const leadCuts = []

    // the package: one outline, the pin-1 notch cut out of its top edge
    const [x0, x1, y0, y1] = [PKG_X + 0.5, PKG_X + PKG_W - 0.5, PKG_TOP + 0.5, pkgBottom - 0.5]
    const [nx0, nx1] = [CX - NOTCH[0] / 2 + 0.5, CX + NOTCH[0] / 2 - 0.5]
    const pkg = [
      `<path d="M${x0} ${y0}H${nx0}V${PKG_TOP + NOTCH[1] - 0.5}H${nx1}V${y0}H${x1}V${y1}H${x0}Z" fill="${s.card}" stroke="${outline}" shape-rendering="crispEdges"/>`,
      rect(PKG_X + 26, PKG_TOP + 10, 6, 6, { fill: s.brand }),
    ].join("")

    /**
     * One layout's leads and labels. Each lead is anchored to its own box at
     * the package edge, so every lead of a layer prints the same dots, as
     * the site's mask tiles do; the left side is the right side mirrored.
     */
    const pins = ({ lead: [lw, lh], cell, label, gap }, key) => {
      // one lead cut per tone, printed with <use x y>, which moves its lattice with it
      const cut = new Map()
      const lead = (p, r) => {
        const fill = p ? dither(level(p.group), cell) : ncLead
        if (!cut.has(fill)) cut.set(fill, `${key}${cut.size}`)
        return `<use href="#${cut.get(fill)}" x="${PKG_X + PKG_W}" y="${n(pinY(r) - lh / 2)}"/>`
      }
      const placed = `<g transform="matrix(-1 0 0 1 ${W} 0)">${left.map(lead).join("")}</g>${right.map(lead).join("")}`
      leadCuts.push(...[...cut].map(([fill, id]) => `<rect id="${id}" width="${lw}" height="${lh}" fill="${fill}"/>`))
      const leads = `<g shape-rendering="crispEdges">${placed}</g>`
      // labels hang off the leads; a long name shrinks the side's type, never the sheet
      const lx = PKG_X - lw - gap
      const rx = PKG_X + PKG_W + lw + gap
      const room = (strs, avail) => {
        const widest = Math.max(...strs.map((str) => t.width(str, { face: "body", size: label })))
        return widest <= avail ? label : Math.floor(((label * avail) / widest) * 4) / 4
      }
      const size = Math.min(room(names(left), lx - TRIM - 16), room(names(right), W - TRIM - 16 - rx))
      const set = (side, x, anchor) => (keep) =>
        side
          .map((p, r) => [p, r])
          .filter(([p]) => keep(p))
          .map(([p, r]) => [p ? p.name : "nc", x, mid(pinY(r), "body", size), anchor])
      const on = (p) => !!p
      const off = (p) => !p
      const labels = [
        t.block({ face: "body", size, fill: s.type }, [...set(left, lx, "end")(on), ...set(right, rx)(on)]),
        t.block({ face: "body", size, fill: ncType }, [...set(left, lx, "end")(off), ...set(right, rx)(off)]),
      ].join("")
      return leads + labels
    }

    // pin numbers along the inside edges, as on the site
    const numbers = t.block({ face: "mono", size: NUM, fill: s.muted }, [
      ...left.map((_, r) => [pad2(r + 1), PKG_X + 8, mid(pinY(r), "mono", NUM)]),
      ...right.map((_, r) => [pad2(total - r), PKG_X + PKG_W - 8, mid(pinY(r), "mono", NUM), "end"]),
    ])

    // markings on the package, centred on it as one block: maker, part, line, date code
    const markings = [
      // the maker's mark: the K's ink runs 22.5 to 77.5 down its 100 unit cell, 30 to 76 across
      kMark({ x: n(CX - 0.53 * 26), y: n(cy - 48), size: 26, color: s.muted }),
      t.block({ face: "heading", size: 30, tracking: -0.025, fill: s.type }, [[part, CX, n(cy + 4), "middle"]]),
      t.block({ face: "mono", size: SMALL, fill: s.muted }, [
        ["full-stack", CX, n(cy + 28), "middle"],
        [`rev ${clock.year}`, CX, n(cy + 43), "middle"],
      ]),
    ].join("")
    const partM = [
      kMark({ x: n(CX - 0.53 * 32), y: n(cy - 54), size: 32, color: s.muted }),
      t.block({ face: "heading", size: 34, tracking: -0.025, fill: s.type }, [[part, CX, n(cy + 10), "middle"]]),
    ].join("")

    // legend: a swatch of each layer's tone, three to a row across the sheet
    const colW = (W - 2 * EDGE) / 3
    const legendAt = (g) => [EDGE + (g % 3) * colW, legendY + Math.floor(g / 3) * LEGEND_PITCH]
    const ranges = layers.map((l, g) => `${pad2(start[g])} to ${pad2(start[g] + l.items.length - 1)}`)
    const swatches = layers
      .map((_, g) => {
        const [x, y] = legendAt(g)
        return `<rect width="12" height="12" fill="${dither(level(g), DESK.cell)}" transform="translate(${n(x)} ${n(y - 10)})"/>`
      })
      .join("")
    const legend = [
      `<g shape-rendering="crispEdges">${swatches}</g>`,
      t.block(
        { face: "mono", size: SMALL, fill: s.muted },
        layers.map((_, g) => [ranges[g], legendAt(g)[0] + 22, legendAt(g)[1]])
      ),
      t.block(
        { face: "mono", size: SMALL, fill: s.type },
        layers.map((l, g) => [
          l.layer.toLowerCase(),
          legendAt(g)[0] + 22 + t.width(`${ranges[g]} `, { face: "mono", size: SMALL }),
          legendAt(g)[1],
        ])
      ),
    ].join("")

    // one caption set as two runs: a line on desktop; on a phone it breaks
    // after the figure's name and sits in the room the legend leaves
    const [c1, c2] = ["figure 1. pin configuration,", `dip-${total}, top view`]
    const captionD = t.block({ face: "mono", size: SMALL, fill: s.muted }, [
      [c1, EDGE, captionY],
      [c2, EDGE + t.width(`${c1} `, { face: "mono", size: SMALL }), captionY],
    ])
    const captionM = t.block({ face: "mono", size: CAPTION_M, fill: s.muted }, [
      [c1, EDGE, n(pkgBottom + 56)],
      [c2, EDGE, n(pkgBottom + 84)],
    ])

    const body = [
      rect(TRIM, TRIM, W - 2 * TRIM, H - 2 * TRIM, { fill: s.paper }),
      cropMarks(TRIM, TRIM, W - 2 * TRIM, H - 2 * TRIM, { color: s.crop, gap: 2, len: 7 }),
      pkg,
      `<g class="d">${pins(DESK, "L")}${numbers}${markings}${legend}${captionD}</g>`,
      `<g class="m">${pins(PHONE, "M")}${partM}${captionM}</g>`,
    ].join("\n")

    const nc = right[0] ? "" : ` Pin ${total} is not connected.`
    files.push({
      name: `ks30-${theme}.svg`,
      body: doc({
        width: W,
        height: H,
        title: `Figure 1. Pin configuration, ${part}`,
        desc: `The stack drawn as a ${total}-pin chip, ${part}. ${layers.map((l) => `${l.layer}: ${l.items.join(", ")}.`).join(" ")}${nc}`,
        defs: dither.defs() + leadCuts.join("") + t.defs(),
        css: `.m{display:none}@media (max-width:500px){.d{display:none}.m{display:inline}}`,
        body,
      }),
    })
  }
  return files
}
