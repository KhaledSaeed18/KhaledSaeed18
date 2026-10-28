// Dev-only. A proof of the README as GitHub would print it: the markdown is
// rendered by GitHub's own API (so the sanitizer has its say), images that
// point at the published prints are swapped for the local build in dist/,
// and the page is set in GitHub's markdown CSS in both themes, at desktop
// and phone widths, then photographed in headless Chrome.
//
//   npm run build && node press/tools/preview.mjs [--at 1500,4000] [--only dark-desktop]
//
// Writes .proof/<theme>-<width>[-<ms>].png and .proof/readme-<theme>.html.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { launch } from "./cdp.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))
const out = `${root}.proof/`
mkdirSync(out, { recursive: true })
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const times = (arg("at") ?? "2500").split(",").map(Number)
const only = arg("only")

const html = execFileSync(
  "gh",
  ["api", "markdown", "-f", "mode=markdown", "-f", "context=KhaledSaeed18/KhaledSaeed18", "-F", `text=@${root}README.md`],
  { encoding: "utf8" }
)
  // The /markdown endpoint (unlike a real README page) links the <img> of a
  // linked <picture> to itself, which splits the picture out of its link.
  // Put it back the way the README page renders it. Checked against
  // vercel/turborepo's README: broken by the endpoint, intact on the page.
  .replace(
    /<a ([^>]*)>(\s*)<themed-picture[^>]*><picture>([\s\S]*?)<\/picture><\/themed-picture>\s*<\/a><a target="_blank" rel="noopener noreferrer nofollow" href="[^"]*">(<img[^>]*>)<\/a>/g,
    (_, a, ws, inner, img) => `<a ${a}>${ws}<picture>${inner}${img}</picture></a>`
  )
  .replace(/<themed-picture[^>]*>|<\/themed-picture>/g, "")

// published prints -> the local build; repo-relative paths -> the checkout
const local = html
  .replace(
    /https:\/\/raw\.githubusercontent\.com\/KhaledSaeed18\/KhaledSaeed18\/(?:refs\/heads\/)?([^/"]+)\/([^"?#\s]+)/g,
    (_, branch, path) => `file://${root}${branch === "prints" ? "dist/" : ""}${path}`
  )
  .replace(/(src|srcset|href)="(?!https?:|file:|mailto:|#|data:)([^"]+)"/g, (_, a, p) => `${a}="file://${root}${p}"`)

// GitHub's markdown CSS for each theme
const css = {}
for (const theme of ["dark", "light"]) {
  css[theme] = `/tmp/ks-press/github-markdown-${theme}.css`
  if (!existsSync(css[theme])) {
    mkdirSync("/tmp/ks-press", { recursive: true })
    execFileSync("curl", ["-sSL", "-o", css[theme], `https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-${theme}.css`])
  }
}

// GitHub's <themed-picture> picks the source from the theme setting, not the
// OS; do the same here, so each theme's page carries its own pulls
const themed = (html, theme) =>
  html.replace(/<picture>([\s\S]*?)<\/picture>/g, (all, inner) => {
    const light = inner.match(/<source media="\(prefers-color-scheme: light\)" srcset="([^"]+)"/)
    const img = inner.match(/<img[^>]*>/)[0]
    return `<picture>${theme === "light" && light ? img.replace(/src="[^"]+"/, `src="${light[1]}"`) : img}</picture>`
  })

const page = (theme) => `<!doctype html><html style="color-scheme:${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="file://${css[theme]}">
<style>
  body { margin: 0; background: ${theme === "dark" ? "#0d1117" : "#ffffff"}; }
  /* the profile README: an 846px column inside a bordered box */
  .wrap { max-width: 896px; margin: 24px auto; padding: 0 16px; }
  .box { border: 1px solid ${theme === "dark" ? "#30363d" : "#d1d9e0"}; border-radius: 6px; }
  .head { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 16px 24px 0; color: ${theme === "dark" ? "#f0f6fc" : "#1f2328"}; }
  .markdown-body { padding: 16px 24px 24px; }
  @media (max-width: 600px) { .wrap { padding: 0 16px; margin: 16px auto; } .markdown-body { padding: 12px 16px 16px; } }
</style></head><body><div class="wrap"><div class="box">
<div class="head">KhaledSaeed18 / README.md</div>
<article class="markdown-body">${themed(local, theme)}</article></div></div></body></html>`
for (const theme of ["dark", "light"]) writeFileSync(`${out}readme-${theme}.html`, page(theme))

const views = [
  ["dark", 1280],
  ["light", 1280],
  ["dark", 390],
  ["light", 390],
].filter(([t, w]) => !only || only === `${t}-${w === 390 ? "phone" : "desktop"}`)

const chrome = await launch({ port: 9361, width: 1280, height: 900 })
try {
  for (const [theme, width] of views) {
    await chrome.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: width < 600 })
    await chrome.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] })
    const loaded = chrome.once("Page.loadEventFired")
    await chrome.send("Page.navigate", { url: `file://${out}readme-${theme}.html` })
    await loaded
    let elapsed = 0
    for (const t of times) {
      await chrome.sleep(Math.max(0, t - elapsed))
      elapsed = t
      const h = Math.ceil(await chrome.evaluate(`document.querySelector('.wrap').getBoundingClientRect().bottom + 24`))
      const shot = await chrome.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height: h, scale: 1 },
      })
      const name = `${theme}-${width === 390 ? "phone" : "desktop"}${times.length > 1 ? `-${t}` : ""}.png`
      writeFileSync(out + name, Buffer.from(shot.data, "base64"))
      console.log(`.proof/${name}  ${width}x${h}`)
    }
  }
} finally {
  await chrome.close()
}
