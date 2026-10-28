// The one number the press prints from GitHub: the year's contributions,
// the same figure GitHub's own calendar shows under the README. Read with
// the workflow's token (or the gh CLI locally); if GitHub is down, the last
// printing's figure is reused.
import { execFileSync } from "node:child_process"

const QUERY = `query($login: String!) { user(login: $login) { createdAt contributionsCollection { contributionCalendar { totalContributions } } } }`

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
  // locally, borrow the gh CLI's login
  const args = ["api", "graphql", "-f", `query=${query}`, ...Object.entries(variables).flatMap(([k, v]) => ["-f", `${k}=${v}`])]
  return JSON.parse(execFileSync("gh", args, { encoding: "utf8" })).data
}

export async function fetchData({ offline = false, previous = null, username }) {
  if (offline) return previous ? { ...previous, stale: true } : null
  for (const wait of [0, 2000, 8000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait))
    try {
      const d = await graphql(QUERY, { login: username })
      return {
        fetched: new Date().toISOString(),
        contributions: d.user.contributionsCollection.contributionCalendar.totalContributions,
        since: d.user.createdAt,
      }
    } catch (e) {
      console.warn(`data: ${e.message}`)
    }
  }
  return previous ? { ...previous, stale: true } : null
}
