// The proofreader. Every printing is checked before it is published: if a
// sheet breaks a house rule, the press does not run and the last good
// printing stays up.
//
//   node press/proof.mjs [dist] [README.md] [--strict]
//
// Fails on: malformed SVG, live type or scripts, external resources,
// anything rounded, em dashes or emoji in what visitors read, files over
// budget, README images without alt text, with a height (GitHub boxes and
// rounds those), with whitespace inside their link, or pointing at a print
// that does not exist. Warns when a sheet's two pulls drift apart.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { PRINTS, readme } from "./readme.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const at = (p) => (p.startsWith("/") ? p : root + p)
const dir = `${at(args[0] ?? "dist")}/`.replace(/\/+$/, "/")
const readmePath = at(args[1] ?? "README.md")
const strict = process.argv.includes("--strict")

// KB, per printed file; night editions of the masthead are smaller
const BUDGET = [
  [/^masthead-/, 170],
  [/^postcard-/, 80],
  [/^ks30-/, 70],
  [/^slug-/, 50],
  [/^rule-/, 12],
  [/^stamp-/, 12],
]

const errors = []
const warnings = []
const fail = (file, msg) => errors.push(`${file}: ${msg}`)
const warn = (file, msg) => warnings.push(`${file}: ${msg}`)

const EM_DASH = /\u2014/
const EMOJI = /\p{Extended_Pictographic}/u
const FORBIDDEN = [
  [/<text[\s>]/, "live <text> (set type as outlines)"],
  [/<script/i, "a script"],
  [/<foreignObject/i, "foreignObject"],
  [/@font-face/, "a font face (set type as outlines)"],
  [/href="https?:/, "an external href"],
  [/url\(\s*["']?https?:/, "an external url()"],
  [/\srx="|\sry="/, "a rounded corner (rx/ry)"],
  [/<circle|<ellipse/, "a circle (dots are squares)"],
  [/linecap="round"|linejoin="round"|linecap:\s*round|linejoin:\s*round/, "a round cap or join"],
  [/border-radius/, "a border radius"],
]

/** Minimal XML well-formedness: balanced tags, quoted attributes. */
function wellFormed(xml) {
  const stack = []
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi
  let m
  while ((m = re.exec(xml))) {
    if (m[0].startsWith("<!--") || m[0].startsWith("<?")) continue
    if (m[0] === "<") return `stray "<" at ${m.index}`
    if (m[0].startsWith("&")) return `unescaped "&" at ${m.index}`
    const [, close, name, , self] = m
    if (self) continue
    if (close) {
      const open = stack.pop()
      if (open !== name) return `</${name}> closes <${open ?? "nothing"}>`
    } else stack.push(name)
  }
  return stack.length ? `unclosed <${stack.at(-1)}>` : null
}

const visible = (svg) => [...svg.matchAll(/<(title|desc)[^>]*>([^<]*)</g)].map((m) => m[2]).join(" ")
const shape = (svg) => (svg.match(/<[a-zA-Z]/g) ?? []).length

if (!existsSync(dir)) {
  console.error(`proof: nothing printed in ${dir}`)
  process.exit(1)
}
const files = readdirSync(dir).filter((f) => f.endsWith(".svg"))
for (const f of files) {
  const svg = readFileSync(dir + f, "utf8")
  const bad = wellFormed(svg)
  if (bad) fail(f, `not well-formed XML: ${bad}`)
  if (!/^<svg[\s>]/.test(svg.trimStart())) fail(f, "does not start with <svg>")
  for (const [re, what] of FORBIDDEN) if (re.test(svg)) fail(f, `contains ${what}`)
  if (!/<title[\s>]/.test(svg)) fail(f, "has no <title>")
  if (EM_DASH.test(visible(svg))) fail(f, "an em dash in its title or description")
  if (EMOJI.test(visible(svg))) fail(f, "an emoji in its title or description")
  const kb = statSync(dir + f).size / 1024
  const budget = BUDGET.find(([re]) => re.test(f))?.[1]
  if (budget && kb > budget) fail(f, `${kb.toFixed(1)} KB, over its ${budget} KB budget`)
  if (/-dark\.svg$/.test(f)) {
    const light = f.replace(/-dark\.svg$/, "-light.svg")
    if (!existsSync(dir + light)) fail(f, `has no light pull (${light})`)
    else {
      const a = shape(svg)
      const b = shape(readFileSync(dir + light, "utf8"))
      if (Math.abs(a - b) > Math.max(4, a * 0.05)) warn(f, `pulls differ: ${a} elements dark, ${b} light`)
    }
  }
}

if (existsSync(readmePath)) {
  const md = readFileSync(readmePath, "utf8")
  const prose = md.replace(/<!--[\s\S]*?-->/g, "")
  if (EM_DASH.test(md)) fail("README.md", "an em dash")
  if (EMOJI.test(prose)) fail("README.md", "an emoji")
  for (const m of md.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0]
    if (!/\salt="/.test(tag)) fail("README.md", `an image without alt: ${tag.slice(0, 80)}`)
    if (/\sheight=/.test(tag)) fail("README.md", `an image with a height (GitHub boxes it): ${tag.slice(0, 80)}`)
  }
  for (const m of md.matchAll(/<a\b[^>]*>(\s*)<(?:picture|img)[\s\S]*?<\/(?:picture)>(\s*)<\/a>/g))
    if (m[1] || m[2]) fail("README.md", "whitespace inside a linked image (GitHub underlines it)")
  for (const m of md.matchAll(new RegExp(`${PRINTS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([\\w.-]+)`, "g")))
    if (!existsSync(dir + m[1])) fail("README.md", `points at ${m[1]}, which was not printed`)
  if (process.argv.includes("--readme") && md !== readme()) fail("README.md", "out of date: run node press/readme.mjs --write")
}

for (const w of warnings) console.warn(`warn  ${w}`)
for (const e of errors) console.error(`FAIL  ${e}`)
if (errors.length || (strict && warnings.length)) {
  console.error(`proof: ${errors.length} error(s), ${warnings.length} warning(s). Not publishing.`)
  process.exit(1)
}
console.log(`proof: ${files.length} sheets clean${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`)
