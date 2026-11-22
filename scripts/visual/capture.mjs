// Visual check sheet: the same fixed shots every run, so a change can be judged before and after.
//
//   npm run build:pages
//   node --experimental-strip-types scripts/visual/capture.mjs --label before [--models woodlouse,ant-worker] [--lineup]
//
// Writes artifacts/visual/<label>/: one PNG per shot, stats.json (draw calls, triangles, which views worked)
// and sheet.png (every shot on one page, captioned). Scores go in docs/visual-rubric.md's form, not here.
// The game runs from dist/ with a fixed starter save (same world every run) and ?hour= for the light.
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { createWorld, simulateStep } from '../../src/sim/ecosystem.ts'
import { beginDaylitWorld } from '../../src/sim/climate.ts'
import { adoptPouredJar } from '../../src/sim/pouredPond.ts'
import { setPondShape } from '../../src/sim/pond.ts'
import { withStarterGarden } from '../../src/sim/starterGarden.ts'
import { encodeAutosave, autosaveKey } from '../../src/sim/autosave.ts'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = resolve(new URL('../..', import.meta.url).pathname)
const args = process.argv.slice(2)
const option = (name, fallback) => { const at = args.indexOf(`--${name}`); return at < 0 ? fallback : args[at + 1] }
const label = option('label', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'))
const models = (option('models', '') || '').split(',').filter(Boolean)
const lineup = args.includes('--lineup')
const out = join(root, 'artifacts', 'visual', label)
mkdirSync(out, { recursive: true })
if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error('No dist/: run npm run build:pages first')

// Fixed world: the default poured jar with the starter garden, one day in (same every run).
const jar = JSON.parse(readFileSync(join(root, 'src/sim/defaultJar.json'), 'utf8'))
let world = adoptPouredJar(beginDaylitWorld(createWorld()), jar)
setPondShape(world.substrate)
world = withStarterGarden(world)
for (let hour = 0; hour < 24; hour++) world = simulateStep(world).world
const save = encodeAutosave(world, [], 0)

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' }
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname)
  let file = join(root, path)
  if (!file.startsWith(root)) { response.writeHead(403).end(); return }
  if (path.endsWith('/')) file = join(file, 'index.html')
  if (!existsSync(file)) { response.writeHead(404).end(); return }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  response.end(readFileSync(file))
})
await new Promise((done) => server.listen(0, done))
const base = `http://localhost:${server.address().port}`

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const shots = []
const stats = { label, at: new Date().toISOString(), game: {}, models: {}, problems: [] }

async function gamePage(hour) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (error) => stats.problems.push(`page error (hour ${hour}): ${error.message.slice(0, 200)}`))
  await page.addInitScript(([key, value]) => { try { localStorage.clear(); localStorage.setItem(key, value) } catch {} }, [autosaveKey, save])
  await page.goto(`${base}/dist/?debug&hour=${hour}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__three, null, { timeout: 60000 })
  await page.waitForTimeout(12000)
  return page
}
const hideUi = (page) => page.evaluate(() => { const canvas = document.querySelector('canvas'); document.querySelectorAll('body *').forEach((node) => { if (!node.contains(canvas) && !canvas.contains(node)) node.style.visibility = 'hidden' }) })
const showUi = (page) => page.evaluate(() => document.querySelectorAll('body *').forEach((node) => { node.style.visibility = '' }))
const frameStats = (page) => page.evaluate(() => new Promise((done) => {
  const { gl } = window.__three
  gl.info.autoReset = false; gl.info.reset()
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const { calls, triangles } = gl.info.render
    gl.info.autoReset = true
    done({ calls, triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures })
  }))
}))
async function shoot(page, name, caption, { ui = false } = {}) {
  if (!ui) await hideUi(page)
  const file = join(out, `${name}.png`)
  await page.screenshot({ path: file })
  if (!ui) await showUi(page)
  const frame = await frameStats(page)
  stats.game[name] = frame
  shots.push({ file, caption: `${caption} · ${frame.calls} calls · ${(frame.triangles / 1000).toFixed(0)}k tris` })
}
// A model whose fetch timed out (6 s) shows a Retry label. Software rendering here starves the page, so press
// Retry until the labels clear (at most 3 rounds) and report only what still fails after that.
async function retryModels(page) {
  for (let round = 0; round < 3; round++) {
    const labels = await page.locator('.asset-retry').count()
    if (!labels) return 0
    await page.locator('.asset-retry').evaluateAll((buttons) => buttons.forEach((button) => button.click()))
    await page.waitForTimeout(8000)
  }
  return page.locator('.asset-retry').count()
}

// Day: UI shot, overview, three-quarter, macro, then the cutaway and underwater views.
const day = await gamePage(10)
const missing = await retryModels(day)
if (missing) stats.problems.push(`${missing} "model unavailable" label(s) still showing after 3 retries`)
await shoot(day, 'ui-day', 'Day 10:00, with UI', { ui: true })
const home = await day.evaluate(() => { const t = window.__three; return { pos: t.camera.position.toArray(), target: t.controls.target.toArray() } })
const aim = async (pos, target) => { await day.evaluate(([p, t]) => { const x = window.__three; x.camera.position.set(...p); x.controls.target.set(...t); x.controls.update() }, [pos, target]); await day.waitForTimeout(4000) }
const [tx, ty, tz] = home.target
await aim(home.pos, home.target); await shoot(day, 'overview-day', 'Overview, 10:00')
await aim([tx + 3.2, ty + 2.2, tz + 3.2], [tx + 0.3, ty + 0.6, tz + 0.5]); await shoot(day, 'three-quarter-day', 'Three-quarter, 10:00')
await aim([tx + 1.2, ty + 1.4, tz + 1.6], [tx + 0.6, ty + 1.0, tz + 0.9]); await shoot(day, 'macro-day', 'Macro, 10:00')
for (const [id, name, caption] of [['view-underground', 'underground', 'Underground cutaway'], ['view-underwater', 'underwater', 'Underwater']]) {
  await aim(home.pos, home.target)
  const button = day.getByTestId(id)
  if (await button.isDisabled()) { stats.problems.push(`${caption} button disabled in the fixed save`); continue }
  await button.click()
  await day.waitForTimeout(7000)
  await shoot(day, name, caption)
  await day.getByTestId('view-surface').click()
  await day.waitForTimeout(3000)
}
await day.close()

// Night: same overview under the lamp and moon.
const night = await gamePage(22)
await retryModels(night)
await shoot(night, 'overview-night', 'Overview, 22:00')
await night.close()

// Models: six views each for the named ones; one three-quarter view of every organism for --lineup.
const organisms = join(root, 'public/assets/organisms')
const modelShot = async (model, view) => {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } })
  await page.goto(`${base}/scripts/visual/turntable.html?glb=/public/assets/organisms/${model}.glb&view=${view}`)
  await page.waitForFunction(() => window.__stats, null, { timeout: 30000 })
  await page.waitForTimeout(500)
  const info = await page.evaluate(() => window.__stats)
  const file = join(out, `model-${model}-${view}.png`)
  await page.screenshot({ path: file })
  await page.close()
  stats.models[model] = info
  if (info.error) stats.problems.push(`${model}: ${info.error}`)
  shots.push({ file, caption: `${model} · ${view} · ${info.triangles ?? '?'} tris · ${info.materials ?? '?'} mats` })
}
for (const model of models) for (const view of ['front', 'back', 'left', 'right', 'top', 'three-quarter']) await modelShot(model, view)
if (lineup) for (const file of readdirSync(organisms).filter((name) => name.endsWith('.glb')).sort()) if (!models.includes(file.slice(0, -4))) await modelShot(file.slice(0, -4), 'three-quarter')

// Contact sheet: every shot captioned on one page.
const tiles = shots.map(({ file, caption }) => `<figure><img src="data:image/png;base64,${readFileSync(file).toString('base64')}"><figcaption>${caption}</figcaption></figure>`).join('')
const problems = stats.problems.length ? `<p class="bad">${stats.problems.join('<br>')}</p>` : '<p>No problems found.</p>'
const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await sheet.setContent(`<style>body{margin:16px;font:14px system-ui;background:#f3eedf;color:#2f3a2c}h1{font-size:20px;margin:0 0 4px}.bad{color:#9b3b2a}main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img{width:100%;border-radius:6px;display:block}figcaption{margin-top:4px}</style><h1>Visual check · ${label}</h1>${problems}<main>${tiles}</main>`)
await sheet.screenshot({ path: join(out, 'sheet.png'), fullPage: true })
writeFileSync(join(out, 'stats.json'), JSON.stringify(stats, null, 2))
await browser.close()
server.close()
console.log(`${shots.length} shots → ${join(out, 'sheet.png')}`)
if (stats.problems.length) console.log(stats.problems.join('\n'))
