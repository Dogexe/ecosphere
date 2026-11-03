// Install reviewed local adaptations and append exact provenance fingerprints.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const dir = 'public/assets/organisms/'
const manifest = JSON.parse(readFileSync(`${dir}manifest.json`))
for (const kind of ['worker', 'queen', 'larva', 'pupa']) {
  const file = `ant-${kind}.glb`
  copyFileSync(`artifacts/candidates/ant-${kind}-candidate.glb`, dir + file)
  const bytes = readFileSync(dir + file), length = bytes.readUInt32LE(12)
  const doc = JSON.parse(bytes.subarray(20, 20 + length))
  const triangles = doc.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((sum, primitive) => sum + doc.accessors[primitive.indices].count / 3, 0), 0)
  const entry = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), triangles, clips: (doc.animations ?? []).map((clip) => clip.name) }
  const index = manifest.findIndex((item) => item.file === file)
  if (index >= 0) manifest[index] = entry
  else manifest.push(entry)
}
writeFileSync(`${dir}manifest.json`, JSON.stringify(manifest, null, 2) + '\n')
console.log(manifest.filter((item) => item.file.startsWith('ant-')))
