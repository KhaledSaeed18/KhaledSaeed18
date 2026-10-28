// Press hours: the last year's commits, counted by the hour of day they were
// written in Beirut. The slug prints them as 24 patches under the portrait's
// bedtime, 01:00 to 07:00.
//
// The press reads every repository GitHub credits him with this year
// (contributionsCollection), then pages each default branch's history for
// his commits, 100 at a time, one query after another. What it keeps is a
// tally per Beirut day and hour in <cache>/hours.json, the workflow's own
// Actions cache, so the next day only asks for what is new. Nothing per
// commit is written anywhere: no hashes, no messages, no repository names.
// Only the 24 totals leave this file.
//
// The workflow's GITHUB_TOKEN sees public repositories (scope "public"); a
// read-only PRESS_TOKEN that can see his private ones makes it "all". Locally
// it borrows the gh CLI's login, the same way press/lib/data.mjs does, which
// sees everything; PRESS_HOURS_SCOPE=public (or --public) keeps to public
// work whatever the token can see.
//
//   node press/lib/hours.mjs                     print the totals (live, with .cache)
//   node press/lib/hours.mjs --public --fixture  also write press/fixtures/hours.json
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const DAYS = 365 // the window: today and the 364 Beirut days before it
const REBUILD = 28 // days between full recounts, which heal any drift
const VERSION = 1
const DAY_MS = 86_400_000

// ---------------------------------------------------------------- GraphQL

async function graphql(query, variables) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (token) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "khaledsaeed18-press" },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) throw new Error(`graphql ${res.status}`)
    const json = await res.json()
    if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "))
    return json.data
  }
  // locally, borrow the gh CLI's login; null variables are simply left out
  const args = ["api", "graphql", "-f", `query=${query}`]
  for (const [k, v] of Object.entries(variables)) if (v != null) args.push("-f", `${k}=${v}`)
  const json = JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 << 20, stdio: ["ignore", "pipe", "pipe"] }))
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "))
  return json.data
}

/** One query, retried gently (2 s, then 8 s) before giving up. */
async function ask(query, variables) {
  let last
  for (const wait of [0, 2000, 8000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait))
    try {
      const data = await graphql(query, variables)
      // leave headroom for the rest of the build (and anything else on the token)
      if (data.rateLimit && data.rateLimit.remaining < 100) throw Object.assign(new Error("rate limit nearly spent"), { fatal: true })
      return data
    } catch (e) {
      last = e
      if (e.fatal) break
    }
  }
  throw last
}

const REPOS = `query($login: String!, $year: DateTime!, $from: DateTime!) {
  rateLimit { remaining }
  user(login: $login) {
    id
    year: contributionsCollection(from: $year) { commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner isPrivate } } }
    recent: contributionsCollection(from: $from) { commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner isPrivate } } }
  }
}`

const HISTORY = `query($owner: String!, $name: String!, $author: ID!, $since: GitTimestamp!, $after: String) {
  rateLimit { remaining }
  repository(owner: $owner, name: $name) {
    defaultBranchRef { target { ... on Commit {
      history(first: 100, after: $after, since: $since, author: { id: $author }) {
        pageInfo { hasNextPage endCursor }
        nodes { authoredDate committedDate }
      }
    } } }
  }
}`

const WEEKS = `query($login: String!) {
  user(login: $login) { contributionsCollection { contributionCalendar { weeks { contributionDays { contributionCount } } } } }
}`

// ------------------------------------------------------------ Beirut days

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Beirut",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
})

/** A moment as Beirut reads it: { day: "2026-10-28", hour: 14 }. */
export function beirutHour(at) {
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 }
}

const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

/** The earliest UTC instant that can still be `day` in Beirut (UTC+3 in summer). */
const dayStart = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 3_600_000).toISOString()

// ------------------------------------------------------------------ cache

function readCache(file) {
  try {
    const c = JSON.parse(readFileSync(file, "utf8"))
    return c.version === VERSION ? c : null
  } catch {
    return null
  }
}

/** The 24 totals of a set of days. */
function sum(days) {
  const hours = new Array(24).fill(0)
  for (const row of Object.values(days)) for (let h = 0; h < 24; h++) hours[h] += row[h] ?? 0
  return hours
}

const prune = (days, first) => Object.fromEntries(Object.entries(days).filter(([d]) => d >= first).sort(([a], [b]) => (a < b ? -1 : 1)))

// ------------------------------------------------------------------ press

/**
 * The last 365 days of commits by Beirut hour of day.
 * Returns { hours: number[24], total, scope: "public" | "all", fetched } and,
 * when GitHub could not be reached and the cache stood in, `stale: true`.
 *
 * - offline: read `fixture` (a file of exactly that shape) and nothing else.
 * - otherwise: refresh <cache>/hours.json at most once a Beirut day, asking
 *   only for the days since the last refresh, and recount from scratch
 *   every four weeks or when the token's view changes.
 */
export async function pressHours({ username, cache, offline = false, fixture, scope = process.env.PRESS_HOURS_SCOPE } = {}) {
  if (offline) {
    if (!fixture || !existsSync(fixture)) throw new Error("hours: offline and no fixture")
    const f = JSON.parse(readFileSync(fixture, "utf8"))
    if (!Array.isArray(f.hours) || f.hours.length !== 24) throw new Error("hours: fixture has no 24 totals")
    return { hours: f.hours, total: f.total ?? f.hours.reduce((a, b) => a + b, 0), scope: f.scope ?? "public", fetched: f.fetched }
  }

  const file = cache ? `${cache.replace(/\/?$/, "/")}hours.json` : null
  const now = new Date()
  const today = beirutHour(now).day
  const first = addDays(today, -(DAYS - 1))
  const held = file ? readCache(file) : null

  const publicOnly = scope === "public"
  // the press hours are refreshed once a Beirut day
  if (held && held.login === username && held.through === today && (!publicOnly || held.scope === "public")) return totals(held, first)

  try {
    const fresh = await count({ username, held, now, today, first, publicOnly })
    if (file) {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, `${JSON.stringify(fresh)}\n`)
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "hours=refreshed\n")
    }
    return totals(fresh, first)
  } catch (e) {
    if (held && held.login === username) {
      console.warn(`hours: ${e.message}; printing from the cache of ${held.fetched}`)
      return { ...totals(held, first), stale: true }
    }
    throw e
  }
}

function totals(c, first) {
  const hours = sum(prune(c.days, first))
  return { hours, total: hours.reduce((a, b) => a + b, 0), scope: c.scope, fetched: c.fetched }
}

async function count({ username, held, now, today, first, publicOnly }) {
  // a full recount when there is nothing to build on, or every REBUILD days
  const rebuildDue = !held || Date.parse(held.rebuilt) < now.getTime() - REBUILD * DAY_MS || held.through < first
  const cutoff = rebuildDue ? first : held.through // that day was only partly counted last time
  const r = await ask(REPOS, { login: username, year: dayStart(first), from: dayStart(addDays(cutoff, -1)) })
  const user = r.user
  if (!user) throw new Error(`hours: no user ${username}`)
  const visible = (c) => c.commitContributionsByRepository.map((x) => x.repository).filter((x) => !publicOnly || !x.isPrivate)
  const year = visible(user.year)
  // the token can see private work only if some came back
  const scope = year.some((x) => x.isPrivate) ? "all" : "public"
  const full = rebuildDue || held.scope !== scope || held.user !== user.id
  const since = full ? first : cutoff
  const repos = (full ? year : visible(user.recent)).map((x) => x.nameWithOwner)

  // keep what was counted before the cutoff; everything from it on is recounted
  const days = full ? {} : Object.fromEntries(Object.entries(held.days).filter(([d]) => d < since))
  const lastLook = full ? 0 : Date.parse(held.fetched)
  let pages = 0
  for (const repo of repos) {
    const [owner, name] = repo.split("/")
    let after = null
    try {
      do {
        const d = await ask(HISTORY, { owner, name, author: user.id, since: dayStart(since), after })
        pages++
        const history = d.repository?.defaultBranchRef?.target?.history
        if (!history) break
        for (const { authoredDate, committedDate } of history.nodes) {
          const { day, hour } = beirutHour(new Date(authoredDate))
          if (day < first || day > today) continue
          // written before the cutoff: counted already, unless it landed on the
          // branch after the last look (a rebase or a late merge)
          if (day < since && Date.parse(committedDate) <= lastLook) continue
          ;(days[day] ??= new Array(24).fill(0))[hour]++
        }
        after = history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null
      } while (after)
    } catch (e) {
      if (e.fatal) throw e
      // one repository that will not answer should not stop the press
      console.warn(`hours: skipped a repository after retries (${e.message})`)
    }
  }
  const fetched = now.toISOString()
  console.log(`hours: ${full ? "recounted" : `counted since ${since}`}, ${repos.length} repositories, ${pages} pages, scope ${scope}`)
  return {
    version: VERSION,
    login: username,
    user: user.id,
    scope,
    rebuilt: full ? fetched : held.rebuilt,
    fetched,
    through: today,
    days: prune(days, first),
  }
}

/**
 * The fallback: the contribution calendar's weeks, oldest first, as GitHub
 * prints them below the README. Returns { weeks: number[], total, fetched }.
 */
export async function pressWeeks({ username, offline = false, fixture } = {}) {
  if (offline) {
    const f = fixture && existsSync(fixture) ? JSON.parse(readFileSync(fixture, "utf8")) : null
    if (!Array.isArray(f?.weeks) || !f.weeks.length) throw new Error("weeks: offline and no fixture")
    return { weeks: f.weeks, total: f.weeks.reduce((a, b) => a + b, 0), fetched: f.fetched }
  }
  const d = await ask(WEEKS, { login: username })
  const weeks = d.user.contributionsCollection.contributionCalendar.weeks.map((w) =>
    w.contributionDays.reduce((a, x) => a + x.contributionCount, 0)
  )
  return { weeks, total: weeks.reduce((a, b) => a + b, 0), fetched: new Date().toISOString() }
}

// ------------------------------------------------------------------- CLI

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL("../../", import.meta.url))
  const i = process.argv.indexOf("--cache")
  const cache = `${root}${i > 0 ? process.argv[i + 1] : ".cache"}/`
  const { identity } = await import("../content.mjs")
  const h = await pressHours({ username: identity.username, cache, scope: process.argv.includes("--public") ? "public" : undefined })
  const night = h.hours.slice(1, 7).reduce((a, b) => a + b, 0)
  console.log(h.hours.map((n, k) => `${String(k).padStart(2, "0")} ${String(n).padStart(5)}`).join("\n"))
  console.log(`${h.total} commits (${h.scope}), ${((100 * night) / Math.max(1, h.total)).toFixed(1)}% between 01:00 and 06:59`)
  if (process.argv.includes("--fixture")) {
    const w = await pressWeeks({ username: identity.username })
    const out = `${root}press/fixtures/hours.json`
    writeFileSync(out, `${JSON.stringify({ hours: h.hours, total: h.total, scope: h.scope, fetched: h.fetched, weeks: w.weeks }, null, 2)}\n`)
    console.log(`wrote ${out}`)
  }
}
