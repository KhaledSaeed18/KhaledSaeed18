// Dev-only. Pulls the live portrait off khaledsaeed.tech's own shader, frame
// by frame, so the README prints the same figure as the site.
//
// It drives the site's WebGL portrait (components/dither-character.tsx) in
// headless Chrome on a virtual clock: requestAnimationFrame and
// performance.now are replaced, Math.random is seeded, and every frame is
// read straight off the canvas, where one canvas pixel is one dither cell.
// Pointer events make him look out of the page and wave; ?sleep dozes him.
//
//   1. run the site:  cd ../khaledsaeed.tech && pnpm dev -p 3456
//   2. capture:       node press/tools/capture-portrait.mjs [http://localhost:3456]
//
// Writes press/assets/portrait.json: every sequence cropped to one shared
// box, cells packed one byte each (0 paper, 1 shadow, 2 ink) and deflated.
import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { deflateSync } from "node:zlib"

const SITE = process.argv[2] ?? "http://localhost:3456"
const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const OUT = new URL("../assets/portrait.json", import.meta.url)

/** 30 fps on the virtual clock; `every` keeps one frame in n. */
const FPS = 30
/** The portrait's box on the page: wide enough for 2px dots, ~190 rows. */
const BOX = [700, 380]

const SEQUENCES = {
  // looks out of the page, waves once, then holds the reader's eye
  // (breathing, blinks): one session, so the hand-off has no cut
  greet: {
    query: "?still",
    seed: 11,
    actions: [
      { do: "point" },
      { do: "wait", frames: 45 },
      { do: "click" },
      { do: "grab", frames: 50, every: 2 },
      { do: "hold", frames: 90, every: 2 },
    ],
  },
  // between 01:00 and 07:00 Beirut time he dozes
  sleep: {
    query: "?still&sleep",
    seed: 5,
    warmup: 150,
    actions: [{ do: "grab", frames: 40, every: 3 }],
  },
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function capture(name, plan, port) {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/ks-portrait-${port}`,
      "--window-size=1400,900",
      "--ignore-gpu-blocklist",
      "--enable-gpu",
      "--use-angle=metal",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" }
  )
  try {
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
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
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
    const run = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed")
      return r.result.value
    }

    await send("Page.enable")
    await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, opts) {
          if (type === 'webgl2') opts = { ...(opts || {}), preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false };
          return get.call(this, type, opts);
        };
        // the site steps down to larger dots when the GPU looks slow; on a
        // virtual clock every frame looks slow, so keep the probe out of it
        WebGL2RenderingContext.prototype.fenceSync = () => null;
        let seed = ${plan.seed};
        Math.random = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
        const base = performance.now(); let vt = 0;
        performance.now = () => base + vt;
        const q = []; let id = 0;
        window.requestAnimationFrame = (cb) => (q.push([++id, cb]), id);
        window.cancelAnimationFrame = (i) => { const k = q.findIndex((e) => e[0] === i); if (k >= 0) q.splice(k, 1) };
        window.__step = (ms) => { vt += ms; for (const [, cb] of q.splice(0)) cb(base + vt) };
        window.__qlen = () => q.length;
        document.addEventListener('DOMContentLoaded', () => {
          const st = document.createElement('style');
          st.textContent = 'div.group.pointer-events-none.relative:has(> canvas){width:${BOX[0]}px!important;height:${BOX[1]}px!important;flex:none!important;max-width:none!important}';
          document.head.appendChild(st);
        });
      })()`,
    })
    await send("Page.navigate", { url: SITE + plan.query })
    for (let i = 0; i < 200; i++) {
      await sleep(150)
      if (await run(`!!document.querySelector('canvas') && !!window.__qlen && window.__qlen() > 0`).catch(() => false)) break
    }

    await run(`(() => {
      const c = document.querySelector('canvas');
      window.__cells = () => {
        const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
        const x = t.getContext('2d'); x.drawImage(c, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let s = '';
        for (let i = 0; i < d.length; i += 4) s += String.fromCharCode(d[i + 3] === 0 ? 0 : d[i] > 128 ? 2 : 1);
        return { w: c.width, h: c.height, b64: btoa(s) };
      };
      window.__head = () => {
        const { w, h, b64 } = window.__cells(); const s = atob(b64);
        let top = h, bottom = 0;
        for (let i = 0; i < s.length; i++) if (s.charCodeAt(i)) { const y = (i / w) | 0; if (y < top) top = y; if (y > bottom) bottom = y }
        const lim = top + (bottom - top) * 0.28; let sx = 0, sy = 0, n = 0;
        for (let y = top; y < lim; y++) for (let x = 0; x < w; x++) if (s.charCodeAt(y * w + x)) { sx += x; sy += y; n++ }
        if (n < 50) return null; // nothing drawn yet
        const hx = sx / n, hy = sy / n;
        let best = [Math.round(hx), Math.round(hy)], bd = Infinity;
        for (let y = Math.round(hy) - 12; y <= hy + 12; y++) for (let x = Math.round(hx) - 12; x <= hx + 12; x++)
          if (x >= 0 && y >= 0 && x < w && y < h && s.charCodeAt(y * w + x)) { const dd = (x - hx) ** 2 + (y - hy) ** 2; if (dd < bd) { bd = dd; best = [x, y] } }
        const r = c.getBoundingClientRect();
        return [r.left + (best[0] + 0.5) * r.width / w, r.top + (best[1] + 0.5) * r.height / h];
      };
      window.__ptr = (type, x, y) => window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
    })()`)

    const step = (n = 1) => run(`(() => { for (let i = 0; i < ${n}; i++) window.__step(${1000 / FPS}) })()`)
    await step(plan.warmup ?? 90)
    let head = null
    for (let i = 0; i < 10 && !head; i++) {
      head = await run(`window.__head()`).catch(() => null)
      if (!head) await step(10)
    }
    if (!head) throw new Error(`${name}: the portrait never drew`)
    const frames = []
    const grab = async () => frames.push(await run(`window.__cells()`))
    for (const a of plan.actions) {
      if (a.do === "point") await run(`window.__ptr('pointermove', ${head[0]}, ${head[1]})`)
      else if (a.do === "click") {
        await run(`window.__ptr('pointermove', ${head[0]}, ${head[1]})`)
        await run(`window.__ptr('pointerdown', ${head[0]}, ${head[1]})`)
      } else if (a.do === "wait") await step(a.frames)
      else
        for (let i = 0; i < a.frames; i++) {
          if (a.do === "hold") await run(`window.__ptr('pointermove', ${head[0]}, ${head[1]})`)
          await step(a.every ?? 1)
          await grab()
        }
    }
    ws.close()
    if (frames.some((f) => f.w !== frames[0].w || f.h !== frames[0].h)) throw new Error(`${name}: canvas resized mid-capture`)
    console.log(`${name}: pointer at ${head.map(Math.round).join(", ")}`)
    console.log(`${name}: ${frames.length} frames at ${frames[0].w}x${frames[0].h}`)
    return { fps: FPS / (plan.actions.find((a) => a.every)?.every ?? 1), frames }
  } finally {
    chrome.kill()
  }
}

const captured = {}
let port = 9340
for (const [name, plan] of Object.entries(SEQUENCES)) captured[name] = await capture(name, plan, port++)

// one shared crop for every sequence, so frames from any of them line up
const { w, h } = Object.values(captured)[0].frames[0]
let [x0, y0, x1, y1] = [w, h, 0, 0]
for (const { frames } of Object.values(captured))
  for (const f of frames) {
    const s = Buffer.from(f.b64, "base64")
    for (let i = 0; i < s.length; i++)
      if (s[i]) {
        const x = i % w
        const y = (i / w) | 0
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
  }
const cols = x1 - x0 + 1
const rows = y1 - y0 + 1
const pack = (f) => {
  const s = Buffer.from(f.b64, "base64")
  const out = Buffer.alloc(cols * rows)
  for (let y = 0; y < rows; y++) s.copy(out, y * cols, (y + y0) * w + x0, (y + y0) * w + x0 + cols)
  return deflateSync(out, { level: 9 }).toString("base64")
}
const json = {
  note: "Frames of the live portrait on khaledsaeed.tech. One byte a cell (0 paper, 1 shadow, 2 ink), deflated. Re-capture with press/tools/capture-portrait.mjs.",
  cols,
  rows,
  sequences: Object.fromEntries(
    Object.entries(captured).map(([k, v]) => [k, { fps: v.fps, frames: v.frames.map(pack) }])
  ),
}
mkdirSync(new URL("../assets/", import.meta.url), { recursive: true })
writeFileSync(OUT, JSON.stringify(json))
console.log(`portrait.json: ${cols}x${rows} cells, ${(JSON.stringify(json).length / 1024).toFixed(0)} KB`)
