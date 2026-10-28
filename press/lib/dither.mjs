// The site's one dither: the 4x4 Bayer lattice behind app/dither.css and the
// portrait shader. A tone of level k (0..16) inks the k cells whose matrix
// value is below k, so every tone here lands on the site's own dots.
export const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

/** Cells inked at `level`, as [x, y] pairs in the 4x4 tile. */
export function cells(level) {
  const out = []
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) if (BAYER[y][x] < level) out.push([x, y])
  return out
}

/**
 * An SVG <pattern> for one tone. `cell` is the size of one dot in user units
 * (the site uses 2px), `color` the ink. Anchored to user space, so every
 * tone on a sheet shares one lattice.
 */
export function pattern(id, level, { cell = 2, color = "currentColor" } = {}) {
  const size = cell * 4
  const rects = cells(level)
    .map(([x, y]) => `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`)
    .join("")
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><g fill="${color}" shape-rendering="crispEdges">${rects}</g></pattern>`
}

/**
 * A sheet's tones. Each (level, colour) gets a class whose fill is a
 * pattern; the sheet's own media queries swap in coarser lattices when
 * GitHub scales the image down, so a dot stays about 2 CSS px instead of
 * shimmering. Only tones a sheet uses are written.
 *
 *   const t = tones()
 *   `<rect class="${t(8, ink)}" .../>`
 *   doc({ defs: t.defs(), css: t.css() })
 */
export function tones({ cell = 2, tiers = [[760, 3], [500, 6]] } = {}) {
  const used = new Map()
  const fn = (level, color) => {
    const key = `${level}|${color}`
    if (!used.has(key)) used.set(key, { level, color, cls: `t${used.size.toString(36)}` })
    return used.get(key).cls
  }
  fn.defs = () =>
    [...used.values()]
      .map(({ level, color, cls }) =>
        [pattern(cls, level, { cell, color }), ...tiers.map(([, c], i) => pattern(`${cls}-${i}`, level, { cell: c, color }))].join("")
      )
      .join("")
  fn.css = () => {
    const base = [...used.values()].map(({ cls }) => `.${cls}{fill:url(#${cls})}`).join("")
    const media = tiers
      .map(
        ([w], i) =>
          `@media (max-width:${w}px){${[...used.values()].map(({ cls }) => `.${cls}{fill:url(#${cls}-${i})}`).join("")}}`
      )
      .join("")
    return base + media
  }
  return fn
}
