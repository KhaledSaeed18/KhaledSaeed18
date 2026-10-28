// The section rules: the site's Sheet label ("// 02 datasheet") over a
// perforation that crosses the rails at registration marks. Transparent, so
// GitHub's page shows through; the rails sit at the same x on every
// full-width sheet, so they run on down the page.
import { doc, hRule, regMark, vRule } from "../lib/sheet.mjs"
import { atlas, measure } from "../lib/type.mjs"

export const W = 846
export const RAILS = [36, 810]

const RULES = [
  ["01", "about", "sheet 01 of 04"],
  ["02", "datasheet", "ks-30 / rev {year}"],
  ["03", "contact", "posted from lebanon"],
  ["04", "colophon", "one drawer at a time"],
]

export default function print({ stocks, themes, clock }) {
  const files = []
  for (const [index, name, meta] of RULES)
    for (const theme of themes) {
      const s = stocks[theme]
      const text = atlas()
      const H = 56
      const metaText = meta.replace("{year}", clock.year)
      // desktop: mono 13 at 1:1; phone (308px column, 0.36x): mono 30, about 11px
      const label = (size, y) => {
        const slash = text("//", { face: "mono", size, x: 48, y, fill: s.brand })
        const w = measure("// ", { face: "mono", size })
        return slash + text(`${index} ${name}`, { face: "mono", size, x: 48 + w, y, fill: s.muted })
      }
      const body = [
        vRule(RAILS[0], 0, H, { color: s.rule }),
        vRule(RAILS[1], 0, H, { color: s.rule }),
        `<g class="d">${label(13, 28)}${text(metaText, { face: "mono", size: 13, x: 798, y: 28, anchor: "end", fill: s.muted })}</g>`,
        `<g class="m">${label(30, 30)}</g>`,
        hRule(0, W, 42, { color: s.rule }),
        regMark(RAILS[0] + 0.5, 42.5, { color: s.brand }),
        regMark(RAILS[1] + 0.5, 42.5, { color: s.brand }),
      ].join("")
      files.push({
        name: `rule-${index}-${theme}.svg`,
        body: doc({
          width: W,
          height: H,
          title: `${index} ${name}`,
          defs: text.defs(),
          css: `.m{display:none}@media (max-width:500px){.d{display:none}.m{display:inline}}`,
          body,
        }),
      })
    }
  return files
}
