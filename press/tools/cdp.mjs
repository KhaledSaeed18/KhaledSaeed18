// A headless Chrome on the DevTools protocol, with nothing to install: Node's
// own WebSocket and fetch. Used by the dev-only tools (portrait capture,
// README preview); the build itself never needs a browser.
import { spawn } from "node:child_process"

const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch({ port = 9350, width = 1400, height = 900, gpu = false, flags = [] } = {}) {
  const args = [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/ks-press-chrome-${port}`,
    `--window-size=${width},${height}`,
    "--hide-scrollbars",
    "--allow-file-access-from-files",
  ]
  args.push(...flags)
  if (gpu) args.push("--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=metal")
  const proc = spawn(CHROME, [...args, "about:blank"], { stdio: "ignore" })
  let wsUrl
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(200)
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl
    } catch {}
  }
  if (!wsUrl) throw new Error("chrome did not start")
  const ws = new WebSocket(wsUrl)
  await new Promise((r) => (ws.onopen = r))
  let seq = 0
  const pending = new Map()
  const listeners = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.method) for (const fn of listeners.get(d.method) ?? []) fn(d.params)
    const p = d.id && pending.get(d.id)
    if (!p) return
    pending.delete(d.id)
    d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result)
  }
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq
      pending.set(id, { res, rej })
      ws.send(JSON.stringify({ id, method, params }))
    })
  const once = (method) =>
    new Promise((res) => {
      const fn = (p) => {
        listeners.set(method, (listeners.get(method) ?? []).filter((f) => f !== fn))
        res(p)
      }
      listeners.set(method, [...(listeners.get(method) ?? []), fn])
    })
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed")
    return r.result.value
  }
  await send("Page.enable")
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false })
  return {
    send,
    once,
    evaluate,
    sleep,
    async close() {
      ws.close()
      proc.kill()
    },
  }
}
