// Dev-only. Is the README still saying what the site says? Loads the site's
// own content (lib/site.ts, lib/content/profile.ts) straight from a
// checkout of khaledsaeed.tech, with Node's built-in TypeScript stripping,
// and compares it with press/content.mjs.
//
//   node press/tools/check-content.mjs [../khaledsaeed.tech]
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import * as ours from "../content.mjs"

const site = resolve(process.argv[2] ?? new URL("../../../khaledsaeed.tech", import.meta.url).pathname)
const tmp = mkdtempSync(join(tmpdir(), "ks-content-"))
copyFileSync(join(site, "lib/site.ts"), join(tmp, "site.ts"))
writeFileSync(
  join(tmp, "profile.ts"),
  readFileSync(join(site, "lib/content/profile.ts"), "utf8").replace(/from "@\/lib\/site"/g, 'from "./site.ts"')
)
const { siteConfig, socialLinks } = await import(pathToFileURL(join(tmp, "site.ts")).href)
const { stack, principles } = await import(pathToFileURL(join(tmp, "profile.ts")).href)

let drift = 0
const same = (what, a, b) => {
  const x = JSON.stringify(a)
  const y = JSON.stringify(b)
  if (x !== y) {
    drift++
    console.log(`drift  ${what}\n  site:   ${x}\n  readme: ${y}`)
  }
}
same("stack", stack, ours.stack)
same("principles", principles, ours.principles)
same("email", socialLinks.find((l) => l.key === "email")?.handle, ours.identity.email)
same("booking", siteConfig.bookingUrl, ours.identity.booking)
for (const l of socialLinks.filter((l) => l.key !== "email" && l.key !== "github")) {
  const stamp = ours.stamps.find((s) => s.href === l.href)
  if (!stamp) {
    drift++
    console.log(`drift  ${l.label}: ${l.href} has no stamp`)
  }
}
console.log(drift ? `${drift} difference(s): update press/content.mjs, then node press/readme.mjs --write` : "content matches the site.")
process.exit(drift ? 1 : 0)
