// The slug: the colour bar at the tail of the sheet. A press sheet ends in a
// strip the printer reads, not the reader: a registration target, a tone
// scale to check the ink against, and the job line. This one also carries
// the press hours, the last year's commits by the hour of day they were
// written in Beirut.
//
// The target is printed off register on purpose: the README links it to the
// site's registration test (/register), the third key to that door.
//
// Static. Hourly for the job line; the hours themselves change once a day.
import { beirut } from "../lib/clock.mjs"
import { pressHours, pressWeeks } from "../lib/hours.mjs"
import { part } from "../lib/part.mjs"
import { cropMarks, doc, rect, vRule } from "../lib/sheet.mjs"
import { measure } from "../lib/type.mjs"
import { patcher, toneRegistry, typeCase } from "./_slug-kit.mjs"

const W = 846
const H = 160
const TRIM = { x: 12, y: 12, w: 822, h: 136 }
const L = 48 // the column the rules and the masthead set from
const R = 798 // and where they end
// the misprint, in units: hypot(2.4, 1.8) = 3, as the README's title says
const OFF = [2.4, -1.8]

const n = (v) => +(+v).toFixed(2)
// A patch holds ink in proportion to its count, the busiest at 16 of 16 dots
// and anything at all at least 2. Weeks are spikier than hours (a release
// week can be ten quiet ones), so they are eased by a square root.
const level = (v, max, ease = (f) => f) => (v <= 0 || max <= 0 ? 0 : Math.max(2, Math.round(16 * ease(v / max))))
const fmtInt = (v) => v.toLocaleString("en-US")
const pad2 = (v) => String(v).padStart(2, "0")

export default async function print(ctx) {
  const { stocks, themes, clock, content } = ctx
  const fixture = `${ctx.root}press/fixtures/hours.json`
  const username = content.identity.username
  const mode = String(process.env.PRESS_HOURS ?? "on").toLowerCase() // on | off | weeks (weeks: proof the fallback)

  let hours = null
  let weeks = null
  if (mode === "on") {
    try {
      hours = await pressHours({ username, cache: ctx.cache, offline: ctx.offline, fixture })
      if (!(hours.total > 0)) hours = null
    } catch (e) {
      console.warn(`slug: ${e.message}`)
    }
  }
  if (mode !== "off" && !hours) {
    try {
      weeks = await pressWeeks({ username, offline: ctx.offline, fixture })
      if (!(weeks.total > 0)) weeks = null
    } catch (e) {
      console.warn(`slug: no weeks either (${e.message})`)
    }
  }

  // the job line: what a printer would read off the tail of the sheet
  const stale = [ctx.data?.stale && ctx.data.fetched, hours?.stale && hours.fetched].filter(Boolean).sort()[0]
  const job = [
    part(content.stack).name.toLowerCase(), // the job: the chip on sheet 02
    `ed. ${ctx.edition || "local"}`,
    `printing ${ctx.printing}`,
    `pulled ${clock.date}, ${clock.clock} beirut`,
    ...(stale ? [`data ${beirut(new Date(stale)).date.replace(/ \d{4}$/, "")}`] : []),
  ].join(" / ")

  const files = []
  for (const theme of themes) {
    const s = stocks[theme]
    const t = typeCase()
    const reg = toneRegistry()
    // the desktop group is seen at 846 (2-unit dots) and 578 (3-unit); the
    // phone group only below 500 px, where 6-unit dots print about 2 px
    const tone = { d: reg.lattice("u", [[null, 2], [760, 3]]), m: reg.lattice("v", [[null, 6]]) }
    const p = patcher()
    const kit = { s, t, tone, p }
    const body = hours
      ? pressHoursSheet({ ...kit, hours, job })
      : weeks
        ? pressWeeksSheet({ ...kit, weeks, job })
        : colourBarSheet({ ...kit, job })
    files.push({
      name: `slug-${theme}.svg`,
      body: doc({
        width: W,
        height: H,
        title: "Press hours",
        desc: describe({ hours, weeks, job }),
        defs: reg.defs() + p.defs() + t.defs(),
        css: `.m{display:none}@media (max-width:500px){.d{display:none}.m{display:inline}}${reg.css()}`,
        body: [paper(s), body].join(""),
      }),
    })
  }
  return files
}

// ------------------------------------------------------------------ parts

/**
 * The strip of stock and the marks where it is cut. The page's dotted rails
 * (x 36 and 810, as on every full-width sheet) run on across it, so the
 * frame closes at the tail of the sheet.
 */
const paper = (s) =>
  rect(TRIM.x, TRIM.y, TRIM.w, TRIM.h, { fill: s.paper }) +
  cropMarks(TRIM.x, TRIM.y, TRIM.w, TRIM.h, { color: s.crop, gap: 2, len: 9 }) +
  vRule(36, TRIM.y, TRIM.y + TRIM.h, { color: s.rule }) +
  vRule(810, TRIM.y, TRIM.y + TRIM.h, { color: s.rule })

/**
 * The registration target: a square with a cross through it, once per
 * plate. The teal plate is home; the terracotta plate is knocked off by OFF.
 */
function target(s, cx, cy) {
  const plate = (color, dx, dy) => {
    const x = cx + dx
    const y = cy + dy
    return `<g fill="none" stroke="${color}" stroke-width="1" shape-rendering="crispEdges"><rect x="${n(x - 10.5)}" y="${n(y - 10.5)}" width="21" height="21"/><path d="M${n(x - 15)} ${n(y)}H${n(x + 15)}M${n(x)} ${n(y - 15)}V${n(y + 15)}"/></g>`
  }
  return plate(s.teal, 0, 0) + plate(s.brand, OFF[0], OFF[1])
}

/** A tone scale: patches of ink from level 0 to 16, `step` apart, in a hairline frame. */
function calibration({ s, p }, tone, x, y, { w = 8, h = 22, color = s.type, frame = true, step = 1 } = {}) {
  let out = ""
  const count = 16 / step + 1
  for (let i = 1; i < count; i++) out += p(x + i * w, y, w, h, tone(i * step, color))
  if (frame) out += rect(x + 0.5, y + 0.5, count * w - 1, h - 1, { fill: "none", stroke: s.rule, "stroke-width": 1, "shape-rendering": "crispEdges" })
  return out
}

/** A row of patches, one per value, terracotta on card stock. */
function patches({ s, p }, tone, values, xs, w, y, h, ease) {
  const max = Math.max(...values)
  const row = p.base(xs, 0, w, h, s.card) + values.map((v, i) => p(xs[i], 0, w, h, tone(level(v, max, ease), s.brand))).join("")
  return `<g transform="translate(0 ${y})">${row}</g>`
}

/** x of each of `count` patches spread from `x0` to `x1`, `gap` apart, whole units. */
function spread(count, x0, x1, w) {
  const pitch = (x1 - x0 - w) / (count - 1)
  return { xs: Array.from({ length: count }, (_, i) => x0 + Math.round(i * pitch)), w }
}

// ------------------------------------------------------------- the sheets

// desktop grid: one row of plates, centred on y 61
const ROW = { y: 46, h: 30, mid: 61 }
const CAL = { x: 90, w: 8, h: 22 } // 17 x 8 = 136, to x 226
const HOURS = { x: 248, w: 21, pitch: 23 } // 24 patches to x 798
// phone grid (0.36x): patches in whole 6-unit dots, two lines of mono 28
const PHONE = { y: 26, h: 36, bar: 67, lines: [101, 133], size: 28 }

function pressHoursSheet({ hours, job, ...kit }) {
  const { s, t, tone } = kit
  const { hours: counts, total, scope } = hours
  const busiest = `${pad2(counts.indexOf(Math.max(...counts)))}:00`
  const hx = (i) => HOURS.x + i * HOURS.pitch
  const xs = counts.map((_, i) => hx(i))

  // -- desktop
  const d = []
  d.push(t(job, { face: "mono", size: 9, x: R, y: 30, anchor: "end", fill: s.muted }))
  d.push(target(s, L + 15, ROW.mid))
  d.push(calibration(kit, tone.d, CAL.x, ROW.mid - CAL.h / 2, CAL))
  d.push(patches(kit, tone.d, counts, xs, HOURS.w, ROW.y, ROW.h))
  for (let h = 0; h < 24; h += 3) d.push(t(pad2(h), { face: "mono", size: 9, x: hx(h) + HOURS.w / 2, y: 88, anchor: "middle", fill: s.muted }))

  const commits = scope === "all" ? "commits" : "public commits"
  d.push(t(`press hours, beirut time. ${fmtInt(total)} ${commits} in the last year; darker patch, busier hour.`, { face: "mono", size: 12, x: L, y: 116, fill: s.muted }))
  const first = "busiest hour: "
  d.push(t(first, { face: "mono", size: 12, x: L, y: 134, fill: s.muted }))
  d.push(t(`${busiest}.`, { face: "mono", size: 12, x: L + measure(first, { face: "mono", size: 12 }), y: 134, fill: s.type }))

  // -- phone: the patches and two lines, at about 10 CSS px
  const m = []
  const ph = spread(24, L, R, 24)
  m.push(patches(kit, tone.m, counts, ph.xs, ph.w, PHONE.y, PHONE.h))
  m.push(t("press hours, beirut time.", { face: "mono", size: PHONE.size, x: L, y: PHONE.lines[0], fill: s.muted }))
  m.push(t(`busiest hour: ${busiest}.`, { face: "mono", size: PHONE.size, x: L, y: PHONE.lines[1], fill: s.type }))

  return `<g class="d">${d.join("")}</g><g class="m">${m.join("")}</g>`
}

function pressWeeksSheet({ weeks, job, ...kit }) {
  const { s, t, tone } = kit
  const counts = weeks.weeks
  const d = []
  d.push(t(job, { face: "mono", size: 9, x: R, y: 30, anchor: "end", fill: s.muted }))
  d.push(target(s, L + 15, ROW.mid))
  d.push(calibration(kit, tone.d, CAL.x, ROW.mid - CAL.h / 2, CAL))
  const dw = spread(counts.length, HOURS.x, R, 8)
  d.push(patches(kit, tone.d, counts, dw.xs, dw.w, ROW.y, ROW.h, Math.sqrt))
  d.push(t("a year ago", { face: "mono", size: 9, x: HOURS.x, y: 88, fill: s.muted }))
  d.push(t("this week", { face: "mono", size: 9, x: R, y: 88, anchor: "end", fill: s.muted }))
  d.push(t("press weeks: the last year by week. darker patch, busier week.", { face: "mono", size: 12, x: L, y: 116, fill: s.muted }))
  d.push(t("github prints the days below.", { face: "mono", size: 12, x: L, y: 134, fill: s.type }))

  const m = []
  const pw = spread(counts.length, L, R, 12)
  m.push(patches(kit, tone.m, counts, pw.xs, pw.w, PHONE.y, PHONE.h, Math.sqrt))
  m.push(t("press weeks: the last year.", { face: "mono", size: PHONE.size, x: L, y: PHONE.lines[0], fill: s.muted }))
  m.push(t("github prints the days below.", { face: "mono", size: PHONE.size, x: L, y: PHONE.lines[1], fill: s.type }))
  return `<g class="d">${d.join("")}</g><g class="m">${m.join("")}</g>`
}

/**
 * PRESS_HOURS=off, or nothing to print: only the colour bar and the job
 * line. Three tone scales, one per plate that inks this README.
 */
function colourBarSheet({ job, ...kit }) {
  const { s, t, tone } = kit
  const inks = [s.type, s.brand, s.teal]
  const d = []
  d.push(target(s, L + 15, ROW.mid))
  // 17 patches 12 wide: a whole tile of the 3-unit lattice each
  const w = 12
  const x0 = 90
  const gap = (R - x0 - 3 * 17 * w) / 2
  inks.forEach((c, i) => d.push(calibration(kit, tone.d, x0 + i * (17 * w + gap), ROW.y, { w, h: ROW.h, color: c })))
  d.push(t(job, { face: "mono", size: 12, x: L, y: 116, fill: s.muted }))

  // phone: nine steps of each, a whole 6-unit tile (24) per patch
  const m = []
  const mw = 24
  const mgap = (R - L - 3 * 9 * mw) / 2
  inks.forEach((c, i) => m.push(calibration(kit, tone.m, L + i * (9 * mw + mgap), PHONE.y, { w: mw, h: PHONE.h, color: c, frame: false, step: 2 })))
  const cut = job.indexOf(" / pulled ")
  m.push(t(job.slice(0, cut), { face: "mono", size: PHONE.size, x: L, y: PHONE.lines[0], fill: s.muted }))
  m.push(t(job.slice(cut + 3), { face: "mono", size: PHONE.size, x: L, y: PHONE.lines[1], fill: s.muted }))
  return `<g class="d">${d.join("")}</g><g class="m">${m.join("")}</g>`
}

function describe({ hours, weeks, job }) {
  if (hours) {
    const busiest = hours.hours.indexOf(Math.max(...hours.hours))
    return `Press hours: ${fmtInt(hours.total)} ${hours.scope === "all" ? "" : "public "}commits in the last year by hour of day in Beirut, busiest at ${pad2(busiest)}:00. ${job}.`
  }
  if (weeks) return `Press weeks: ${fmtInt(weeks.total)} contributions in the last year, by week. ${job}.`
  return `The colour bar: a registration target, off register, and three tone scales. ${job}.`
}
