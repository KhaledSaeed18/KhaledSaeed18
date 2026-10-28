// The site's own icon set (components/print/glyphs.tsx): a 24 unit grid,
// square-capped mitred 1.5 strokes, dots as small squares. Printed from two
// plates: the ink, and a teal plate under it. Parts keep the site's class
// names (g-eyes, g-letter, g-flap...) so a sheet can move them the way
// app/glyphs.css does on hover. Parts the site hides at rest carry
// data-rest="hidden".

const dot = (x, y, s = 1.5, cls) =>
  `<rect${cls ? ` class="${cls}"` : ""} x="${x}" y="${y}" width="${s}" height="${s}" fill="currentColor" stroke="none"/>`

export const GLYPHS = {
  github:
    `<g class="g-head"><path d="M6 4 L9 6.5 H15 L18 4 V9.5 L19 11.5 V14 L15.5 17.5 H8.5 L5 14 V11.5 L6 9.5 Z"/>` +
    `<g class="g-eyes" data-rest="hidden">${dot(8.75, 11)}${dot(13.75, 11)}</g></g>` +
    `<path d="M9.5 17.5 V21 M14.5 17.5 V21"/><path class="g-tail" d="M9.5 19.25 H7 L5 17.25"/>`,
  linkedin:
    `<rect x="3.75" y="3.75" width="16.5" height="16.5"/>` + dot(7.25, 7, 1.5, "g-tittle") +
    `<path d="M8 11 V16.75 M11.5 16.75 V11 M11.5 12.5 L13 11 H15 L16.5 12.5 V16.75"/>`,
  x:
    `<path d="M4.5 4.5 H8.75 L19.5 19.5 H15.25 Z"/>` +
    `<path class="g-hair-up" d="M19 4.5 L13.6 10.4"/><path class="g-hair-down" d="M10.4 13.6 L5 19.5"/>`,
  devto:
    `<rect x="2.75" y="5.25" width="18.5" height="13.5"/>` +
    `<path class="g-type" d="M5.5 9.5 V14.5 H7.25 L8.5 13.25 V10.75 L7.25 9.5 Z M12.5 9.5 H10.25 V14.5 H12.5 M10.25 12 H12 M14.5 9.5 L16.25 14.5 L18 9.5"/>`,
  instagram:
    `<rect x="3.75" y="3.75" width="16.5" height="16.5"/><rect class="g-lens" x="8.25" y="8.25" width="7.5" height="7.5"/>` +
    dot(11.25, 11.25, 1.5, "g-aperture") + dot(16.25, 6.25, 1.5, "g-flash"),
  discord:
    `<g class="g-face"><path d="M8.5 5.5 L9.5 7 H14.5 L15.5 5.5 L19 6.75 L21 15.5 L17 18.5 L15.75 16.5 H8.25 L7 18.5 L3 15.5 L5 6.75 Z"/>` +
    `<g class="g-eyes">${dot(8.5, 11, 2)}${dot(13.5, 11, 2)}</g></g>`,
  mail:
    `<g class="g-letter" data-rest="hidden"><rect x="7" y="1.5" width="10" height="6"/><path d="M9.5 4.5 H14.5"/></g>` +
    `<rect x="3.75" y="6.75" width="16.5" height="11.5"/><path class="g-flap" d="M3.75 6.75 L12 12.5 L20.25 6.75"/>`,
  calendar:
    `<rect x="3.75" y="5.25" width="16.5" height="15"/><path class="g-rings" d="M8 3 V7.25 M16 3 V7.25"/>` +
    `<path d="M3.75 9.75 H20.25"/><path class="g-tick" d="M8.5 15 L11 17.25 L15.5 12.75"/>`,
  save:
    `<path d="M3.75 14.5 V20.25 H20.25 V14.5"/><path class="g-arrow" d="M12 3.75 V14.25 M7.75 10 L12 14.25 L16.25 10"/>`,
}

/**
 * One glyph at x, y, `size` units square, in `ink`. `plate` prints the teal
 * plate under it, offset by `offset` glyph units ([0, 0] is in register).
 * `state` "rest" hides the parts the site hides at rest; "on" shows them.
 */
export function glyph(
  name,
  { x = 0, y = 0, size = 24, ink = "currentColor", plate, offset = [1.25, 1], plateClass, inkClass, state = "rest" } = {}
) {
  let body = GLYPHS[name]
  if (!body) throw new Error(`no glyph ${name}`)
  body = body.replaceAll(` data-rest="hidden"`, state === "rest" ? ` opacity="0"` : "")
  const s = size / 24
  const g = (color, cls) => `<g${cls ? ` class="${cls}"` : ""} color="${color}" stroke="${color}">${body}</g>`
  const under = plate
    ? `<g transform="translate(${offset[0]} ${offset[1]})" opacity="0.9">${g(plate, plateClass)}</g>`
    : ""
  return `<g transform="translate(${x} ${y}) scale(${+s.toFixed(4)})" fill="none" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">${under}${g(ink, inkClass)}</g>`
}
