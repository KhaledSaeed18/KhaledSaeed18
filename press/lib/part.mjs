// The part the stack is drawn as: a quad flat package, one pin per tool, a
// quarter of the pins down each side. Shared by the chip sheet, the rules,
// the slug and the README, so the part number, the pin count and the ranges
// are counted in one place, from the stack, and never typed.
//
// A count that does not divide by four is made up with "nc" (not connected)
// pins at the end, so every side has the same number of pins.

export function part(stack) {
  const pins = stack.flatMap((l, group) => l.items.map((name) => ({ n: 0, name, group })))
  const count = pins.length
  const total = Math.ceil(count / 4) * 4
  while (pins.length < total) pins.push({ n: 0, name: null, group: -1 })
  pins.forEach((p, i) => (p.n = i + 1))
  // each layer's run of pins, in stack order: [from, to]
  let at = 1
  const ranges = stack.map((l) => {
    const r = [at, at + l.items.length - 1]
    at += l.items.length
    return r
  })
  const nc = total - count
  return {
    pins,
    count,
    total,
    side: total / 4,
    ranges,
    nc,
    name: `KS-${total}`, // the part number
    pkg: `qfp-${total}`, // the package, as a datasheet captions it
    // "Pin 97 is not connected." / "Pins 98 to 100 are not connected." / ""
    ncNote: nc === 0 ? "" : nc === 1 ? `Pin ${total} is not connected.` : `Pins ${count + 1} to ${total} are not connected.`,
  }
}
