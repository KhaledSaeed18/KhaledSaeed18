// Dev-only. Photographs sheets the way GitHub shows them: each SVG through
// an <img>, on GitHub's page colour for its theme, at the README column's
// real widths (846 desktop, 578 laptop, 308 phone), at chosen moments of
// its animation.
//
//   node press/tools/shoot.mjs dist/masthead-dark.svg [more.svg...] [--widths 846,308] [--at 300,1500,6000] [--reduced]
//
// Writes .proof/shots/<sheet>-<width>[-<ms>].png at 2x.
import { mkdirSync, writeFileSync } from "node:fs"
import { basename, resolve } from "node:path"

import { launch } from "./cdp.mjs"

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? fallback : args[i + 1]
}
const files = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--reduced"))
const widths = opt("widths", "846,308").split(",").map(Number)
const times = opt("at", "6000").split(",").map(Number)
const reduced = args.includes("--reduced")
const out = resolve(".proof/shots")
mkdirSync(out, { recursive: true })

const chrome = await launch({ port: 9400 + (process.pid % 2000), width: 900, height: 900, flags: reduced ? ["--force-prefers-reduced-motion"] : [] })
try {
  for (const file of files) {
    const path = resolve(file)
    const light = /-light\.svg$/.test(path)
    for (const w of widths) {
      const html = `<!doctype html><html style="color-scheme:${light ? "light" : "dark"}"><body style="margin:0;padding:16px;background:${light ? "#ffffff" : "#0d1117"}"><img id="i" src="file://${path}" width="${w}" style="display:block;max-width:100%"></body></html>`
      const page = `${out}/_page-${process.pid}.html`
      writeFileSync(page, html)
      await chrome.send("Emulation.setDeviceMetricsOverride", { width: w + 32, height: 900, deviceScaleFactor: 2, mobile: false })
      const loaded = chrome.once("Page.loadEventFired")
      await chrome.send("Page.navigate", { url: `file://${page}` })
      await loaded
      let elapsed = 0
      for (const t of times) {
        await chrome.sleep(Math.max(0, t - elapsed))
        elapsed = t
        const h = await chrome.evaluate(`document.getElementById('i').getBoundingClientRect().height + 32`)
        const shot = await chrome.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w + 32, height: h, scale: 1 } })
        const name = `${basename(path, ".svg")}-${w}${times.length > 1 ? `-${t}` : ""}${reduced ? "-reduced" : ""}.png`
        writeFileSync(`${out}/${name}`, Buffer.from(shot.data, "base64"))
        console.log(`.proof/shots/${name}`)
      }
    }
  }
} finally {
  await chrome.close()
}
