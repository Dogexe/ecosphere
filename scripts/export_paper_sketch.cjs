// Draws a placeholder paper sketch in headless Chromium and writes its PNG layers.
// Usage: node scripts/export_paper_sketch.cjs woodlouse
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const animal = process.argv[2]
if (!animal || !/^[\w-]+$/.test(animal)) throw new Error('Usage: node scripts/export_paper_sketch.cjs <animal>')
const sketch = path.join(__dirname, 'paper-sketches', `${animal}.js`)
const out = path.join(__dirname, '..', 'public', 'assets', 'paper', animal)

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')
  await page.addScriptTag({ content: fs.readFileSync(sketch, 'utf8') })
  const layers = await page.evaluate(() => Object.fromEntries(Object.entries(window.paperSketch()).map(([name, canvas]) => [name, canvas.toDataURL('image/png')])))
  fs.mkdirSync(out, { recursive: true })
  for (const [name, url] of Object.entries(layers)) {
    fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'))
    console.log(`${animal}/${name}`)
  }
  await browser.close()
})()
