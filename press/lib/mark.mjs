// The flip-bracket K: a stem and a detached chevron. "|<" reads K; mirrored
// about its own centre, "|>" reads forward. Same geometry as the site's
// app/icon.svg and components/flip-logo.tsx: stem at x 35.5, chevron
// 70.5,28 50.5,50 70.5,72, stroke 11, square caps, mitred join.

/**
 * The mark on a 100 unit grid, scaled to `size` and placed at x, y.
 * `flip` adds a CSS class to the chevron so a sheet can animate it.
 */
export function kMark({ x = 0, y = 0, size = 100, color = "currentColor", chevronClass } = {}) {
  const s = size / 100
  const cls = chevronClass ? ` class="${chevronClass}"` : ""
  return `<g transform="translate(${x} ${y}) scale(${+s.toFixed(4)})" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="square" stroke-linejoin="miter"><line x1="35.5" y1="28" x2="35.5" y2="72"/><polyline${cls} points="70.5,28 50.5,50 70.5,72" style="transform-box:fill-box;transform-origin:center"/></g>`
}
