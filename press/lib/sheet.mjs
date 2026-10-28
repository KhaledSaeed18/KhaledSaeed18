// Print furniture shared by every sheet: the document wrapper, perforated
// rules, dotted rails, registration marks and crop marks. Same vocabulary
// as the site's frame (app/globals.css): 2 on, 4 off dots, 1px rules, a
// 9px registration mark with 1px arms.

const n = (v) => +(+v).toFixed(2)

/**
 * An SVG document. `css` is the sheet's own animation; every sheet gets the
 * reduced-motion rule, which stops all motion and shows each element at its
 * resting frame (set with --rest on the element, or its static attributes).
 */
export function doc({ width, height, title, desc, defs = "", css = "", body }) {
  const style = `${css}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t d" shape-rendering="geometricPrecision">
<title id="t">${esc(title)}</title><desc id="d">${esc(desc ?? title)}</desc>
<style>${style.replace(/\s+/g, " ").trim()}</style>
<defs>${defs}</defs>
${body}
</svg>
`
}

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** A horizontal perforation: 2 units inked, 4 off, `weight` thick. */
export function hRule(x1, x2, y, { color, weight = 1, dash = [2, 4] } = {}) {
  return `<line x1="${n(x1)}" y1="${n(y + weight / 2)}" x2="${n(x2)}" y2="${n(y + weight / 2)}" stroke="${color}" stroke-width="${weight}" stroke-dasharray="${dash.join(" ")}" shape-rendering="crispEdges"/>`
}

/** A vertical perforation (the rails). */
export function vRule(x, y1, y2, { color, weight = 1, dash = [2, 4] } = {}) {
  return `<line x1="${n(x + weight / 2)}" y1="${n(y1)}" x2="${n(x + weight / 2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${weight}" stroke-dasharray="${dash.join(" ")}" shape-rendering="crispEdges"/>`
}

/** A solid hairline. */
export function line(x1, y1, x2, y2, { color, weight = 1, ...rest } = {}) {
  const extra = Object.entries(rest)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("")
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${weight}" shape-rendering="crispEdges"${extra}/>`
}

/** A registration mark (+) centred on x, y: `size` across, 1 unit arms. */
export function regMark(x, y, { color, size = 9, weight = 1 } = {}) {
  const h = size / 2
  return `<g stroke="${color}" stroke-width="${weight}" shape-rendering="crispEdges"><line x1="${n(x - h)}" y1="${n(y)}" x2="${n(x + h)}" y2="${n(y)}"/><line x1="${n(x)}" y1="${n(y - h)}" x2="${n(x)}" y2="${n(y + h)}"/></g>`
}

/**
 * Crop marks outside a trim box: two short strokes at each corner, set off
 * the trim by `gap`, `len` long. The way a press marks where to cut.
 */
export function cropMarks(x, y, w, h, { color, gap = 6, len = 14, weight = 1 } = {}) {
  const segs = []
  const corners = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ]
  for (const [cx, cy, sx, sy] of corners) {
    segs.push([cx + sx * gap, cy, cx + sx * (gap + len), cy])
    segs.push([cx, cy + sy * gap, cx, cy + sy * (gap + len)])
  }
  return `<g stroke="${color}" stroke-width="${weight}" shape-rendering="crispEdges">${segs
    .map(([a, b, c, d]) => `<line x1="${n(a)}" y1="${n(b)}" x2="${n(c)}" y2="${n(d)}"/>`)
    .join("")}</g>`
}

/** A small square: the site's only kind of dot. */
export const square = (x, y, s, fill, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(s)}" height="${n(s)}" fill="${fill}"${extra}/>`

export const rect = (x, y, w, h, attrs = {}) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("")}/>`
