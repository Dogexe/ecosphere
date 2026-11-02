import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const models = new Map<string, Promise<Group | null>>()

function loadModel(file: string) {
  let pending = models.get(file)
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 6000)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/kenney/${file}.glb`, { signal: controller.signal })
        if (!response.ok) return null
        return (await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')).scene
      } catch { return null } finally { window.clearTimeout(timer) }
    })()
    models.set(file, pending)
  }
  return pending
}

// Curated opaque, texture-free CC0 meshes. Shared geometry, local materials.
// Loading never suspends the world; the authored fallback remains interactive.
export function NatureAsset({ file, height, accent, fallback }: {
  file: string; height: number; accent: string; fallback: ReactNode
}) {
  const [source, setSource] = useState<Group | null>(null)
  useEffect(() => {
    let alive = true
    void loadModel(file).then((model) => { if (alive) setSource(model) })
    return () => { alive = false }
  }, [file])
  const model = useMemo(() => {
    if (!source) return null
    const clone = source.clone(true)
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.material = (object.material as MeshStandardMaterial).clone()
      object.material.metalness = 0
      object.material.roughness = 0.94
      object.material.flatShading = true
      object.castShadow = true
      object.receiveShadow = true
    })
    const bounds = new Box3().setFromObject(clone)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    // Keep a wide imported cap compact while preserving its aspect ratio.
    const normalizer = 1 / Math.max(size.y, Math.max(size.x, size.z) * 1.1)
    clone.position.set(-center.x * normalizer, -bounds.min.y * normalizer, -center.z * normalizer)
    clone.scale.setScalar(normalizer)
    return clone
  }, [source])
  useLayoutEffect(() => {
    model?.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const material = object.material as MeshStandardMaterial
      material.color.set(material.name === '_defaultMat' ? '#e9d7b5' : accent)
    })
  }, [model, accent])
  useEffect(() => () => {
    model?.traverse((object) => { if (object instanceof Mesh) (object.material as MeshStandardMaterial).dispose() })
  }, [model])
  return model ? <group scale={height} dispose={null}><primitive object={model} /></group> : <>{fallback}</>
}
