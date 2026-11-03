// Disposable localhost QA only. The first worker fetch fails; native Retry
// must recover against the unchanged production file on its second request.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
const root = resolve('dist')
let failed = false
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.txt': 'text/plain' }
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname === '/assets/organisms/ant-worker.glb' && !failed) {
    failed = true; response.writeHead(503, { 'Cache-Control': 'no-store' }); response.end('Intentional QA failure'); console.log('worker503'); return
  }
  const file = resolve(root, `.${url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)}`)
  if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
  try { const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(bytes); if (file.endsWith('ant-worker.glb')) console.log('worker200') }
  catch { response.writeHead(404); response.end() }
})
server.requestTimeout = 5000
server.headersTimeout = 6000
server.listen(4181, '127.0.0.1', () => console.log('Disposable failure QA on4181'))
