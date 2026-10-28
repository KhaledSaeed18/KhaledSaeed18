// Code 128 (set B), the barcode on shop receipts. Ported from the site's
// lib/code128.ts so the receipt here scans the same way. Each symbol is six
// alternating bar and space widths in modules; the stop symbol has seven.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232",
]
const START_B = 104
const STOP = "2331112"

/**
 * The bars for `text`, as module widths starting with a bar and alternating
 * bar, space, bar... Characters outside printable ASCII are dropped.
 */
export function code128(text) {
  const values = [...text].map((c) => c.charCodeAt(0) - 32).filter((v) => v >= 0 && v < 95)
  const check = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103
  return [START_B, ...values, check]
    .map((v) => PATTERNS[v])
    .concat(STOP)
    .join("")
    .split("")
    .map(Number)
}

/** The bars as SVG rects, `module` units per module, starting at x. */
export function bars(text, { x = 0, y = 0, height = 40, module = 1, fill = "currentColor" } = {}) {
  let pos = x
  let out = ""
  code128(text).forEach((w, i) => {
    if (i % 2 === 0)
      out += `<rect x="${+pos.toFixed(2)}" y="${y}" width="${+(w * module).toFixed(2)}" height="${height}"/>`
    pos += w * module
  })
  return { svg: `<g fill="${fill}" shape-rendering="crispEdges">${out}</g>`, width: pos - x }
}
