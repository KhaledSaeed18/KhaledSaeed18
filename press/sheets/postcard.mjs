// The reply postcard: the site's contact sheet (components/home/contact-sheet.tsx)
// set as a card on the press sheet. Message on the left, the address on dotted
// rules on the right, the stamp with square perforations (the .stamp outline
// in app/globals.css) and its dithered terracotta field with the K, a postmark
// in broken ink slightly off true, and a sorting label whose Code 128 really
// scans: it opens the site's registration test, one of the three keys.
//
// Static. The live line and the postmark date are set at every printing.
import { cropMarks, doc, hRule, rect, vRule } from "../lib/sheet.mjs"
import { atlas, measure, metrics } from "../lib/type.mjs"
import { tones } from "../lib/dither.mjs"
import { kMark } from "../lib/mark.mjs"
import { bars } from "../lib/code128.mjs"

const W = 846
const H = 420
const n = (v) => +(+v).toFixed(2)

// the card: trim 12 in from the sheet edge, perforated 6 in from the trim
const TRIM = { x: 12, y: 12, w: 822, h: 396 }
const PERF = 6
const DIVIDE = 423
// the two sides share one ruled grid, so the dotted lines run across the divider
const LINES = [104, 152, 200, 248, 296]
const ADDRESS = [188, 236, 284] // baselines; each sits 12 above its rule
const LIVE = 312 // the footnote and the live line share this baseline
// the stamp: 87 x 105, so the 3-unit notches leave a full 3-unit tooth at every corner
const STAMP = { x: 719, y: 32, w: 87, h: 105, frame: 6, notch: 3, bite: 2 }
// the sorting label, bone in both pulls
const LABEL = { x: 40, y: 328, w: 766, h: 50 }
const MODULE = 1.75 // 398 modules + 2 x 10 of quiet zone = 731.5 units

// phone: the message side goes, the address grows to mono 40
const M = { to: 60, address: [150, 212, 274], size: 40, live: 314, liveSize: 28, stamp: 1.2 }

export default function print({ stocks, themes, clock, night, content }) {
  const { identity, secret } = content
  const url = `${identity.url}${secret}`
  const files = []
  for (const theme of themes) {
    const s = stocks[theme]
    const t = atlas()
    // the only tones are on the stamp and its cancel, which grow 1.2x on phones,
    // so the phone lattice is 4 units, not 6: about 2 CSS px from 308 to 398
    const tone = tones({ tiers: [[760, 3], [500, 4]] })
    const terra = s.stocks.terracotta
    // the live line leads with the site's "now" marker: a square, half the type size
    const live = night
      ? { copy: "night in beirut. replies after 07:00.", fill: s.muted, mark: s.teal }
      : { copy: `replies from beirut, ${clock.offset}.`, fill: s.muted, mark: s.brand }
    const liveLine = (x, y, size) => {
      const q = size / 2
      const top = Math.round(y - metrics("mono", size).xHeight / 2 - q / 2 - 0.5)
      return rect(x, top, q, q, { fill: live.mark }) + t(live.copy, { face: "mono", size, x: x + q * 2, y, fill: live.fill })
    }

    // ---- the card ----
    const { x: tx, y: ty, w: tw, h: th } = TRIM
    const px1 = tx + PERF
    const py1 = ty + PERF
    const px2 = tx + tw - PERF
    const py2 = ty + th - PERF
    const card = [
      rect(0, 0, W, H, { fill: s.paper }),
      cropMarks(tx, ty, tw, th, { color: s.crop, gap: 3, len: 9 }),
      rect(tx, ty, tw, th, { fill: s.card }),
      hRule(px1, px2, py1, { color: s.rule }),
      hRule(px1, px2, py2 - 1, { color: s.rule }),
      vRule(px1, py1, py2, { color: s.rule }),
      vRule(px2 - 1, py1, py2, { color: s.rule }),
    ].join("")

    // ---- message side (desktop only) ----
    const lineEnd = DIVIDE - 28
    const message = [
      t("message", { face: "mono", size: 12, x: 40, y: 52, fill: s.muted, class: "sm" }),
      ...LINES.map((y) => hRule(40, lineEnd, y, { color: s.rule })),
      t("re:", { face: "mono", size: 18, x: 40, y: LINES[0] - 10, fill: s.muted }),
      t("hello from github", {
        face: "mono",
        size: 18,
        x: 40 + measure("re: ", { face: "mono", size: 18 }),
        y: LINES[0] - 10,
        fill: s.type,
      }),
      t("no postage necessary if posted from github.", { face: "mono", size: 11, x: 40, y: LIVE, fill: s.muted, class: "sm" }),
      vRule(DIVIDE, 36, 320, { color: s.rule }),
    ].join("")

    // ---- address side ----
    const addr = [identity.name, identity.email, identity.location]
    const desk = [
      t("to", { face: "mono", size: 12, x: 452, y: 52, fill: s.muted, class: "sm" }),
      ...ADDRESS.map((y, i) =>
        hRule(452, 806, y + 12, { color: s.rule }) +
        t(addr[i], { face: "mono", size: 22, x: 452, y, fill: i === 0 ? s.headline : s.type })
      ),
      `<g class="lv">${liveLine(452, LIVE, 12)}</g>`,
    ].join("")
    const phone = [
      t("to", { face: "mono", size: 26, x: 40, y: M.to, fill: s.muted }),
      ...M.address.map((y, i) =>
        hRule(40, 806, y + 12, { color: s.rule }) +
        t(addr[i], { face: "mono", size: M.size, x: 40, y, fill: i === 0 ? s.headline : s.type })
      ),
      liveLine(40, M.live, M.liveSize),
    ].join("")

    // ---- the stamp ----
    const stamp = stampOf({ s, t, tone, terra, year: clock.year })

    // ---- the postmark: a square cancel with bars, in broken ink, off true ----
    const postmark = postmarkOf({ s, t, tone, date: clock.date })

    // ---- the sorting label ----
    const code = bars(url, { x: 0, y: 0, height: 30, module: MODULE, fill: s.thermal.ink })
    const x0 = LABEL.x + (LABEL.w - code.width) / 2
    // whole units at the first bar, so the 4-module period lands on whole pixels
    const bx = Math.round(x0)
    const label = [
      rect(LABEL.x, LABEL.y, LABEL.w, LABEL.h, { fill: s.thermal.paper }),
      rect(LABEL.x + 0.5, LABEL.y + 0.5, LABEL.w - 1, LABEL.h - 1, { fill: "none", stroke: s.border, "stroke-width": 1 }),
      bars(url, { x: bx, y: LABEL.y + 6, height: 30, module: MODULE, fill: s.thermal.ink }).svg,
      t("sort lb-bey 01", {
        face: "mono",
        size: 9,
        x: LABEL.x + LABEL.w / 2,
        y: LABEL.y + LABEL.h - 6,
        anchor: "middle",
        fill: s.thermal.ink,
        class: "so",
      }),
    ].join("")

    // on phones the stamp grows about its top right corner and keeps only the
    // cancel's bars: the dated box would be 4 px type beside the name
    const k = M.stamp
    const ox = STAMP.x + STAMP.w
    const oy = STAMP.y
    const grow = `matrix(${k},0,0,${k},${n(ox - ox * k)},${n(oy - oy * k)})`

    const body = [
      card,
      `<g class="d">${message}${desk}</g>`,
      `<g class="m">${phone}</g>`,
      `<g class="st">${stamp}${postmark.svg}</g>`,
      label,
    ].join("")

    files.push({
      name: `postcard-${theme}.svg`,
      body: doc({
        width: W,
        height: H,
        title: "a reply postcard",
        desc: `A reply postcard addressed to ${identity.name}, ${identity.email}, ${identity.location}, with a terracotta stamp bearing the K mark, a postmark from Lebanon dated ${clock.date} and a sorting barcode. ${night ? "Night in Beirut: replies after 07:00." : `Replies from Beirut, ${clock.offset.toUpperCase()}.`}`,
        defs: t.defs() + tone.defs() + postmark.defs,
        // the 578 column (laptops) sets the small mono labels about 10 px; below
        // 760 the dated box of the cancel would be 7 px type, so only its bars stay
        css: `.m{display:none}.sm,.lv{transform-box:fill-box;transform-origin:0 100%}@media (max-width:760px){.sm{transform:scale(1.35)}.lv{transform:scale(1.25)}.pmb{display:none}}@media (max-width:500px){.d{display:none}.m{display:inline}.st{transform:${grow}}.so{display:none}}${tone.css()}`,
        body,
      }),
    })
  }
  return files
}

/** The stamp: a frame with square notches punched along every edge, and the terracotta field. */
function stampOf({ s, t, tone, terra, year }) {
  const { x, y, w, h, frame, notch, bite } = STAMP
  // the frame as one path; each notch is a hole (evenodd) bitten into the edge
  let d = `M${x} ${y}h${w}v${h}h${-w}z`
  for (let o = notch; o + notch <= w - notch; o += notch * 2)
    d += `M${x + o} ${y}h${notch}v${bite}h${-notch}zM${x + o} ${y + h - bite}h${notch}v${bite}h${-notch}z`
  for (let o = notch; o + notch <= h - notch; o += notch * 2)
    d += `M${x} ${y + o}h${bite}v${notch}h${-bite}zM${x + w - bite} ${y + o}h${bite}v${notch}h${-bite}z`
  const fx = x + frame
  const fy = y + frame
  const fw = w - frame * 2
  const fh = h - frame * 2
  // corner labels sit on knockouts of the stock, as on the site (px-0.5 py-px)
  const knock = (str, ax, ay, anchor) => {
    const size = 9
    const tw = measure(str, { face: "mono", size })
    const cap = metrics("mono", size).capHeight
    const even = (v, f) => f(v / 2) * 2
    const bw = even(tw + 4, Math.ceil)
    const bh = 12
    const bxx = even(anchor === "end" ? ax - bw : ax, Math.floor)
    const byy = even(anchor === "bottom" || anchor === "end" ? ay - bh : ay, Math.floor)
    const base = byy + (bh + cap) / 2
    return (
      rect(bxx, byy, bw, bh, { fill: terra.paper }) +
      t(str, { face: "mono", size, x: bxx + (bw - tw) / 2, y: n(base), fill: terra.ink })
    )
  }
  const k = 36
  const kx = Math.round((fx + fw / 2 - k / 2) / 2) * 2
  const ky = Math.round((fy + fh / 2 - k / 2) / 2) * 2
  return [
    `<path d="${d}" fill="${s.stampFrame}" fill-rule="evenodd"/>`,
    rect(fx, fy, fw, fh, { fill: terra.paper }),
    rect(fx, fy, fw, fh, { class: tone(3, terra.ink) }),
    // the K's ink spans 0.25 to 0.78 of its box; clear it by a dot all round
    rect(kx + 8, ky + 6, 22, 24, { fill: terra.paper }),
    knock("lb", fx + 6, fy + 6, "start"),
    kMark({ x: kx, y: ky, size: k, color: terra.ink }),
    knock(String(year), fx + fw - 6, fy + fh - 6, "end"),
  ].join("")
}

/**
 * The postmark, the way it lands on a real card: the dated box straddles the
 * stamp's left edge and its three bars run on across the stamp's face, under
 * the K. Off true by -6 degrees. The box outline and the bars print through a
 * level-11 dither (broken ink, on the press's own lattice); the date is set
 * clean, so it reads.
 */
function postmarkOf({ s, t, tone, date }) {
  const lines = ["posted from", `lebanon, ${date}`]
  const size = 11
  const tw = Math.max(...lines.map((l) => measure(l, { face: "mono", size })))
  const overlap = 14
  // the type ends a few units short of the stamp; only the frame runs onto it
  const bw = Math.ceil(tw + 18 + overlap)
  const bh = 42
  const bx = STAMP.x + overlap - bw
  const cy = 122
  const by = cy - bh / 2
  const barX = bx + bw + 6
  const barW = STAMP.x + STAMP.w - 16 - barX
  const ink = s.type
  // rotate about the box, so the bars rise across the stamp and clear the K
  const cx = bx + bw / 2
  const frame = `<path class="pmb" d="M${n(bx + 0.75)} ${n(by + 0.75)}h${bw - 1.5}v${bh - 1.5}h${-(bw - 1.5)}z" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linejoin="miter"/>`
  const bars3 = [-6, 0, 6].map((dy) => `<rect x="${n(barX)}" y="${n(cy + dy - 0.75)}" width="${n(barW)}" height="1.5"/>`).join("")
  const type =
    `<g class="pmb" opacity="0.85">` +
    t(lines[0], { face: "mono", size, x: bx + 9, y: by + 18, fill: ink }) +
    t(lines[1], { face: "mono", size, x: bx + 9, y: by + 33, fill: ink }) +
    `</g>`
  const region = { x: bx - 24, y: by - 40, w: bw + barW + 60, h: bh + 80 }
  const defs = `<mask id="pm" maskUnits="userSpaceOnUse" x="${n(region.x)}" y="${n(region.y)}" width="${n(region.w)}" height="${n(region.h)}">${rect(region.x, region.y, region.w, region.h, { class: tone(11, "#fff") })}</mask>`
  const svg =
    `<g transform="rotate(-6 ${n(cx)} ${cy})">` +
    `<g mask="url(#pm)" opacity="0.8">${frame}<g fill="${ink}">${bars3}</g></g>${type}</g>`
  return { svg, defs }
}
