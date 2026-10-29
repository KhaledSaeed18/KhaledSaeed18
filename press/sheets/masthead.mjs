// Sheet 00, the masthead: the site's hero, pulled on a press while you
// watch. Paper first, then the plates land in press order: rules, the teal
// targets, terracotta sliding home into register over them, and the ink
// rising last. Then the portrait waves once and holds your eye. The same
// sheet at every hour: nothing on it depends on the clock.
//
// Plates, bottom to top:
//   paper       the stock, its chain lines and watermark (bone shows it)
//   rules       rails, rules, microprint, crop marks
//   teal        the targets the terracotta plate lands on
//   terracotta  marks, the K, the block, the ghost, "explains itself."
//   ink         type, swatches and the portrait
import { cropMarks, doc, hRule, rect, regMark, vRule } from "../lib/sheet.mjs"
import { atlas, measure, metrics } from "../lib/type.mjs"
import { tones } from "../lib/dither.mjs"
import { kMark } from "../lib/mark.mjs"
import { loadPortrait } from "../lib/sprite.mjs"
import { stripImages } from "./_masthead-sprite.mjs"

export const W = 846
export const H = 460
export const RAILS = [36, 810]

const P = "mh" // prefixes every id and class on the sheet
const TRIM = { x: 12, y: 12, w: 822, h: 436 }
const RULES = [64, 392]
const MICRO = [200, 560] // the stretch of the top rule that is type
const CELL = 2
const BOX = { x: 572, y: 76 } // the portrait, 2 units a cell, standing on the trim
const BLOCK = { x: 548, y: 140, w: 120, h: 252 }
const GHOST = [28, -12] // the second plate, off the portrait by this much
const REST = 50 // greet frame he rests on once the wave is done

const MICROPRINT =
  "khaledsaeed18 / press sheet / this rule is type 3.2 units high / you found the microprint / the source of this page has a back room / "

/** Everything on the sheet, plate by plate. */
function plates(ctx, theme) {
  const s = ctx.stocks[theme]
  const { identity } = ctx.content
  const { cols, rows, sequences } = loadPortrait()
  const type = atlas(`${P}g`)
  const raw = tones()
  const tone = (level, color) => P + raw(level, color)
  const second = s.brand
  const fw = cols * CELL
  const fh = rows * CELL

  // ---- paper: the stock, laid with chain lines, watermarked with the K
  const chain = []
  for (let x = 24; x < TRIM.x + TRIM.w; x += 24) chain.push(`M${x} ${TRIM.y}V${TRIM.y + TRIM.h}`)
  const wmSize = 340
  const wm = { x: 300 - wmSize / 2, y: 230 - wmSize / 2 }
  const wmNote = "you held it to the light."
  const wmCap = metrics("mono", 9).capHeight
  // the note runs up the sheet's left margin, between the trim and the
  // rail, where the paper is clear: a mill's mark along the deckle
  const note = { x: (TRIM.x + RAILS[0]) / 2, y: 230 }
  const paper = [
    rect(TRIM.x, TRIM.y, TRIM.w, TRIM.h, { fill: s.paper }),
    // on black stock it is in the file but under the threshold of sight
    `<g opacity="${theme === "light" ? 1 : 0.5}">`,
    `<path d="${chain.join("")}" stroke="${s.watermark}" stroke-width="1" shape-rendering="crispEdges"/>`,
    kMark({ ...wm, size: wmSize, color: s.watermark }),
    `<g transform="rotate(-90 ${note.x} ${note.y})">${type(wmNote, {
      face: "mono",
      size: 9,
      x: note.x,
      y: note.y + wmCap / 2,
      anchor: "middle",
      fill: s.watermark,
    })}</g>`,
    `</g>`,
  ].join("")

  // ---- rules: rails, the two rules (the top one partly type), crop marks
  const micro = microprint(type, { x0: MICRO[0], x1: MICRO[1], y: RULES[0], fill: s.muted })
  const rules = [
    vRule(RAILS[0], TRIM.y, TRIM.y + TRIM.h, { color: s.rule }),
    vRule(RAILS[1], TRIM.y, TRIM.y + TRIM.h, { color: s.rule }),
    hRule(TRIM.x, MICRO[0] - 2, RULES[0], { color: s.rule }),
    micro.svg,
    hRule(MICRO[1] + 2, TRIM.x + TRIM.w, RULES[0], { color: s.rule }),
    hRule(TRIM.x, TRIM.x + TRIM.w, RULES[1], { color: s.rule }),
    cropMarks(TRIM.x, TRIM.y, TRIM.w, TRIM.h, { color: s.crop, gap: 2, len: 9 }),
  ].join("")

  // ---- teal: only the targets the terracotta marks must land on
  const crossings = RULES.flatMap((y) => RAILS.map((x) => [x + 0.5, y + 0.5]))
  const mark = (color) => crossings.map(([x, y]) => regMark(x, y, { color, size: 11, weight: 1.25 })).join("")
  const teal = mark(s.teal)

  // ---- terracotta: the block and its fringe, the ghost, the K, the marks, the last line
  const seq = sequences.greet.frames
  const ghostImages = stripImages(seq, { cols, rows, palette: [null, second], map: (v) => (v === 2 ? 1 : 0), cls: `${P}x` })
  const spriteGroup = (images) => `<g class="${P}s">${images}</g>`
  const win = (x, y, inner) => `<svg x="${x}" y="${y}" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}" overflow="hidden">${inner}</svg>`
  const flip = `${P}k`
  const terracotta = [
    rect(BLOCK.x - 20, BLOCK.y, 20, BLOCK.h, { class: tone(6, second) }),
    rect(BLOCK.x - 32, BLOCK.y, 12, BLOCK.h, { class: tone(2, second) }),
    rect(BLOCK.x, BLOCK.y, BLOCK.w, BLOCK.h, { fill: second }),
    `<g clip-path="url(#${P}trim)">${win(BOX.x + GHOST[0], BOX.y + GHOST[1], spriteGroup(ghostImages))}</g>`,
    type(identity.headline[2], { face: "heading", size: 50, tracking: -0.025, x: 48, y: 292, fill: s.brand }),
    `<g class="${P}d">${kMark({ x: 38, y: 21, size: 34, color: s.brand, chevronClass: flip })}</g>`,
    `<g class="${P}m">${kMark({ x: 34, y: 16, size: 44, color: s.brand, chevronClass: flip })}</g>`,
    mark(s.brand),
  ].join("")

  // ---- ink: the portrait, the type, the swatches
  const portraitImages = stripImages(seq, {
    cols,
    rows,
    palette: [null, s.portrait.shadow, s.portrait.ink],
    cls: `${P}x`,
  })
  const mono = (str, o) => type(str, { face: "mono", ...o })
  const swatches = [16, 8, 4, 2]
    .map((level, i) =>
      level === 16
        ? rect(48 + i * 26, 410, 20, 20, { fill: s.headline })
        : rect(48 + i * 26, 410, 20, 20, { class: tone(level, s.headline) })
    )
    .join("")
  const role = `${identity.role.toLowerCase()} / ${identity.location.toLowerCase()}`

  const ink = [
    win(BOX.x, BOX.y, spriteGroup(portraitImages)),
    type(identity.headline[0], { face: "heading", size: 84, tracking: -0.025, x: 48, y: 170, fill: s.headline }),
    type(identity.headline[1], { face: "heading", size: 50, tracking: -0.025, x: 48, y: 236, fill: s.muted }),
    `<g class="${P}d">`,
    mono(identity.site, { size: 13, x: 76, y: 43, fill: s.type }),
    mono(role, { size: 13, x: 798, y: 43, anchor: "end", fill: s.muted }),
    mono(identity.focus, { size: 14, x: 48, y: 344, fill: s.muted }),
    swatches,
    `</g><g class="${P}m">`,
    mono(identity.site, { size: 30, x: 82, y: 49, fill: s.type }),
    mono(role, { size: 26, x: 48, y: 350, fill: s.muted }),
    `</g>`,
  ].join("")

  const defs = [
    `<clipPath id="${P}trim"><rect x="${TRIM.x}" y="${TRIM.y}" width="${TRIM.w}" height="${TRIM.h}"/></clipPath>`,
    micro.defs,
    raw.defs().replace(/id="t/g, `id="${P}t`),
    type.defs(),
  ].join("")

  const base = [
    raw.css().replace(/\.t/g, `.${P}t`).replace(/#t/g, `#${P}t`),
    `.${P}m{display:none}.${P}x{image-rendering:pixelated}`,
    `@media (max-width:500px){.${P}d{display:none}.${P}m{display:inline}.${P}x{image-rendering:auto}}`,
  ].join("")

  return { width: W, height: H, defs, css: base, paper, rules, teal, terracotta, ink, frames: seq.length }
}

/** The motion, on the plate groups and sprites of plates(). */
function motionCss({ frames }) {
  const fh = loadPortrait().rows * CELL
  const ty = (f) => `translateY(${-f * fh}px)`
  const wave = REST / 15 // frames 0..49 at 15 fps
  const hold = (frames - REST) / 15 // frames 50..139, back and forth
  const start = 1.3
  const handoff = +(start + wave).toFixed(3)
  return [
    // press order: rules, teal, terracotta landing in register, ink rising
    `.${P}1{animation:${P}f .3s ease-out backwards}`,
    `.${P}2{animation:${P}f .3s .15s ease-out backwards}`,
    `.${P}3{animation:${P}f .2s .25s ease-out backwards,${P}r .8s .45s cubic-bezier(.22,1,.36,1) backwards}`,
    `.${P}4{animation:${P}u .5s .8s cubic-bezier(.22,1,.36,1) backwards}`,
    `@keyframes ${P}f{from{opacity:0}}`,
    `@keyframes ${P}r{from{transform:translate(10px,-6px)}}`,
    `@keyframes ${P}u{from{opacity:0;transform:translateY(8px)}}`,
    // the portrait rests on frame 50; it waves 0..49 once, then holds 50..139
    `.${P}s{transform:${ty(REST)};animation:${P}w ${handoff - start}s ${start}s steps(${REST},jump-none) backwards,${P}h ${hold}s ${handoff}s steps(${frames - REST},jump-none) infinite alternate}`,
    `@keyframes ${P}w{from{transform:translateY(0)}to{transform:${ty(REST - 1)}}}`,
    `@keyframes ${P}h{from{transform:${ty(REST)}}to{transform:${ty(frames - 1)}}}`,
    // the site's logo-flip (components/flip-logo.tsx, auto mode)
    `.${P}k{animation:${P}k 5s 1.6s cubic-bezier(.65,0,.35,1) infinite}`,
    `@keyframes ${P}k{0%{transform:scaleX(1)}14%{transform:scaleX(-1)}40%{transform:scaleX(-1)}54%{transform:scaleX(1)}100%{transform:scaleX(1)}}`,
  ].join("")
}

/**
 * The microprint: JetBrains Mono at 3.2 units, sitting on the rule's line
 * from x0 to x1. One phrase is set once (every letter a bare <use> with an
 * x in font units) and repeated, clipped to the stretch.
 */
function microprint(type, { x0, x1, y, fill }) {
  const size = 3.2
  const { xHeight } = metrics("mono", size)
  const baseline = y + 0.5 + xHeight / 2
  const set = type(MICROPRINT, { face: "mono", size, x: 0, y: 0 })
  const s = size / 1000
  const uses = [...set.matchAll(/href="#([\w-]+)" transform="translate\(([-\d.]+) [-\d.]+\) scale\([\d.]+\)"/g)]
    .map(([, id, tx]) => `<use href="#${id}" x="${Math.round(+tx / s)}"/>`)
    .join("")
  const phrase = measure(MICROPRINT, { face: "mono", size })
  const copies = []
  for (let x = x0; x < x1; x += phrase) copies.push(`<use href="#${P}mp" x="${+(x / s).toFixed(0)}"/>`)
  return {
    defs: `<clipPath id="${P}mc"><rect x="${x0}" y="${y - 4}" width="${x1 - x0}" height="8"/></clipPath><g id="${P}mp">${uses}</g>`,
    svg: `<g clip-path="url(#${P}mc)"><g fill="${fill}" opacity=".55" transform="translate(0 ${+baseline.toFixed(2)}) scale(${s})">${copies.join("")}</g></g>`,
  }
}

function sheet(ctx, theme) {
  const p = plates(ctx, theme)
  const { identity } = ctx.content
  const motion = motionCss(p)
  const title = `${identity.name} ${identity.headline.slice(1).join(" ")}`
  const desc = `${title} Full-stack engineer in Lebanon: interfaces, backends and developer tools, beside a 1-bit dithered self-portrait that waves hello.`
  const plate = (n, body) => `<g class="${P}${n}">${body}</g>`
  return doc({
    width: W,
    height: H,
    title,
    desc,
    defs: p.defs,
    css: p.css + motion,
    body: [p.paper, plate(1, p.rules), plate(2, p.teal), plate(3, p.terracotta), plate(4, p.ink)].join("\n"),
  })
}

export default function print(ctx) {
  return ctx.themes.map((theme) => ({ name: `masthead-${theme}.svg`, body: sheet(ctx, theme) }))
}
