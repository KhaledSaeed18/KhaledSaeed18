// The press. Reads the clock, the content and the data, pulls every sheet in
// both stocks, and lays the prints out in one folder for the `prints` branch.
//
//   node press/build.mjs [--out dist] [--at 2026-10-28T23:30:00Z] [--offline] [--last .last]
//
// Each sheet in press/sheets exports print(ctx) -> [{ name, body }]. The
// build regenerates every file on every run; the workflow only publishes
// when something a visitor can see has changed.
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"

import * as content from "./content.mjs"
import { beirut } from "./lib/clock.mjs"
import { fetchData } from "./lib/data.mjs"
import { stocks, themes } from "./lib/palette.mjs"

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  return v === undefined || v.startsWith("--") ? true : v
}

const root = fileURLToPath(new URL("../", import.meta.url))
const out = `${root}${arg("out", "dist")}/`.replace(/\/+$/, "/")
const at = arg("at") ? new Date(arg("at")) : new Date()
if (Number.isNaN(at.getTime())) throw new Error(`--at: not a date`)
const only = arg("only")
const last = arg("last") ? `${root}${arg("last")}/` : null

const clock = beirut(at)
const edition = (process.env.GITHUB_SHA ?? safe(() => execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })) ?? "")
  .trim()
  .slice(0, 7)
const printing = Number(process.env.GITHUB_RUN_NUMBER ?? 0)
const previous = last && existsSync(`${last}data.json`) ? JSON.parse(readFileSync(`${last}data.json`, "utf8")) : null
// --data <file> prints from a saved figure (fixtures, previews) instead of asking GitHub
const data = arg("data")
  ? JSON.parse(readFileSync(`${root}${arg("data")}`, "utf8"))
  : await fetchData({ offline: arg("offline", false), previous, username: content.identity.username })

const ctx = {
  clock,
  at,
  edition,
  printing,
  data,
  content,
  stocks,
  themes,
  root,
  // sheets that read their own data (press hours) follow these
  offline: !!(arg("offline", false) || arg("data")),
  cache: `${root}${arg("cache", ".cache")}/`,
  last,
}

if (!only) rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const sheets = readdirSync(`${root}press/sheets`)
  .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
  .filter((f) => !only || only.split(",").includes(f.replace(/\.mjs$/, "")))
  .sort()

const written = []
for (const file of sheets) {
  const mod = await import(pathToFileURL(`${root}press/sheets/${file}`).href)
  const files = await mod.default(ctx)
  for (const { name, body } of files) {
    writeFileSync(out + name, body)
    written.push({ name, bytes: Buffer.byteLength(body) })
  }
}

const state = {
  printed: at.toISOString(),
  beirut: `${clock.date} ${clock.clock} ${clock.offset}`,
  edition,
  printing,
  data: data ? { fetched: data.fetched, stale: !!data.stale } : null,
}
writeFileSync(`${out}state.json`, `${JSON.stringify(state, null, 2)}\n`)
if (data) writeFileSync(`${out}data.json`, `${JSON.stringify(data, null, 2)}\n`)

const pad = (s, n) => String(s).padEnd(n)
for (const w of written) console.log(`${pad(w.name, 34)} ${(w.bytes / 1024).toFixed(1).padStart(7)} KB`)
console.log(`printed ${state.beirut}, ed. ${edition || "local"}`)

// for the workflow: did anything a visitor can see change since the last printing?
if (process.env.GITHUB_OUTPUT && last) {
  const changed = written.some(({ name }) => !existsSync(last + name) || readFileSync(last + name, "utf8") !== readFileSync(out + name, "utf8"))
  appendFileSync(process.env.GITHUB_OUTPUT, `publish=${changed ? "yes" : "no"}\n`)
  console.log(changed ? "publishing" : "nothing changed")
}

function safe(fn) {
  try {
    return fn()
  } catch {
    return null
  }
}
