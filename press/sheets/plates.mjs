// The plates: the masthead pulled apart into the five plates it is printed
// from, the README's version of the site's x key (plate separation). Paper,
// rules, teal, terracotta and ink, each laid on its own film in an oblique
// view, fanned out; every ten seconds they slide into register and apart
// again. Reduced motion leaves them fanned.
import { layers } from "./masthead.mjs"
import { doc } from "../lib/sheet.mjs"
import { atlas, measure } from "../lib/type.mjs"

const W = 846
const H = 440
// the oblique projection: x' = 0.52x + 0.34y, y' = -0.14x + 0.30y
const M = [0.52, -0.14, 0.34, 0.3]
// each film sits this far up and right of the one below it
const STEP = [52, -38]
const PLATES = ["paper", "rules", "teal", "terracotta", "ink"]
const n = (v) => +(+v).toFixed(2)

export default function print(ctx) {
  const files = []
  for (const theme of ctx.themes) {
    const s = ctx.stocks[theme]
    const L = layers(ctx, theme)
    const t = atlas("pg")
    // the projected film is 596 x 256; five of them fan out to 804 x 408
    const span = [n(M[0] * L.width + M[2] * L.height), n(-M[1] * L.width + M[3] * L.height)]
    const fan = [span[0] + STEP[0] * 4, span[1] - STEP[1] * 4]
    const ox = n((W - fan[0]) / 2)
    // the film's top corner is (0, 0); its lowest point is (0, H) projected
    const oy = n((H - fan[1]) / 2 - M[1] * L.width - STEP[1] * 4)
    const mid = 2 // they come into register on the middle film
    const films = PLATES.map((name, i) => {
      const at = [n(ox + STEP[0] * i), n(oy + STEP[1] * i)]
      const film = `<rect width="${L.width}" height="${L.height}" fill="none" stroke="${s.muted}" stroke-opacity="0.55" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="2 4"/>`
      // the label sits by the film's lower left corner, upright
      const corner = [n(at[0] + M[2] * L.height), n(at[1] + M[3] * L.height)]
      // "1 paper": the number in terracotta, the plate's name after it
      const nameW = measure(name, { face: "mono", size: 13 })
      const label =
        `<g class="lb">` +
        t(name, { face: "mono", size: 13, x: corner[0] - 12, y: corner[1] + 4, anchor: "end", fill: s.muted }) +
        t(`${i + 1}`, { face: "mono", size: 13, x: corner[0] - 20 - nameW, y: corner[1] + 4, anchor: "end", fill: s.brand }) +
        `</g>`
      const labelM =
        `<g class="lbm">` +
        t(`${i + 1} ${name}`, { face: "mono", size: 24, x: corner[0] - 14, y: corner[1] + 8, anchor: "end", fill: s.muted }) +
        `</g>`
      return (
        `<g transform="translate(${at[0]} ${at[1]})"><g class="f f${i}">` +
        `<g transform="matrix(${M.join(" ")} 0 0)">${L[name]}${film}</g></g></g>` +
        `<g class="tags">${label}${labelM}</g>`
      )
    })
    // each film travels to the middle one and back; labels step aside while they are in register
    const keys = PLATES.map((_, i) => {
      const d = [n(STEP[0] * (mid - i)), n(STEP[1] * (mid - i))]
      return `@keyframes f${i}{0%,20%{transform:none}34%,60%{transform:translate(${d[0]}px,${d[1]}px)}74%,100%{transform:none}}.f${i}{animation:f${i} 10s cubic-bezier(.65,0,.35,1) infinite}`
    }).join("")
    const css =
      L.css +
      keys +
      `@keyframes tags{0%,20%{opacity:1}28%,66%{opacity:0}74%,100%{opacity:1}}.tags{animation:tags 10s linear infinite}` +
      `.lbm{display:none}@media (max-width:500px){.lb{display:none}.lbm{display:inline}}`
    files.push({
      name: `plates-${theme}.svg`,
      body: doc({
        width: W,
        height: H,
        title: "the plates",
        desc: "The masthead separated into its five plates, from the bottom: paper, rules, teal, terracotta and ink. They slide into register and apart again.",
        defs: L.defs + t.defs(),
        css,
        body: films.join(""),
      }),
    })
  }
  return files
}
