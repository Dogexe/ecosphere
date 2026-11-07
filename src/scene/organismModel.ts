import { AnimationMixer, Box3, Color, Group, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3 } from 'three'
import type { AnimationAction } from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

export type OrganismFile = 'natural-clover' | 'natural-mushroom' | 'natural-hollow-log' | 'tiger-beetle' | 'pond-fish' | 'daphnia' | 'leaf-grazer' | 'woodlouse' | 'springtail' | 'clover' | 'grass' | 'bloom' | 'tree' | 'lily' | 'reed' | 'ant-worker' | 'ant-queen' | 'ant-larva' | 'ant-pupa'
export type ModelShape = ({ length: number; base: number; centered?: boolean; measure?: 'max' } | { spread: number; height: number; base?: number }) & { fallen?: boolean }

// Independent bones/mixers, shared immutable geometry/textures. Normalization
// lives above the imported animated root, so clips cannot undo game scale.
export function instantiateOrganism(source: GLTF, shape: ModelShape) {
  const model = clone(source.scene)
  const materials: MeshStandardMaterial[] = []
  const baseColors: Color[] = []
  const flowers: Mesh[] = []
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const local = (Array.isArray(object.material) ? object.material : [object.material]).map((material) => {
      const copy = (material as MeshStandardMaterial).clone()
      copy.roughness = 0.94
      copy.metalness = 0
      materials.push(copy)
      baseColors.push(copy.color.clone())
      return copy
    })
    object.material = local.length === 1 ? local[0] : local
    if (local.some((material) => material.name.startsWith('Flowers'))) flowers.push(object)
    object.castShadow = true
    object.receiveShadow = true
  })
  model.updateMatrixWorld(true)
  model.traverse((object) => { if (object instanceof SkinnedMesh) object.skeleton.update() })
  const bounds = new Box3().setFromObject(model, true)
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  const root = new Group()
  const normalizer = new Group()
  root.add(normalizer)
  normalizer.add(model)
  if ('length' in shape) {
    normalizer.scale.setScalar(shape.length / Math.max(0.001, shape.measure === 'max' ? Math.max(size.x, size.y, size.z) : size.z))
    model.position.add(new Vector3(-center.x, shape.centered ? -center.y : -bounds.min.y, -center.z))
    normalizer.position.y = shape.base
  } else {
    const horizontal = shape.spread / Math.max(0.001, size.x, size.z)
    normalizer.scale.set(horizontal, shape.height / Math.max(0.001, size.y), horizontal)
    model.position.add(new Vector3(-center.x, -bounds.min.y, -center.z))
    normalizer.position.y = shape.base ?? 0
  }
  if (shape.fallen) {
    root.rotation.z = Math.PI * 0.48
    root.updateMatrixWorld(true)
    model.traverse((object) => { if (object instanceof SkinnedMesh) object.skeleton.update() })
    const fallen = new Box3().setFromObject(root, true)
    root.position.x -= fallen.getCenter(new Vector3()).x
    root.position.y += (shape.base ?? 0) - fallen.min.y
  }
  // Measure before the renderer attaches transformed ancestors. Brood picking
  // needs a model-local center; measuring later in the scene would double
  // apply its chamber position/rotation when building the screen-space target.
  root.updateMatrixWorld(true)
  const normalizedBounds = new Box3().setFromObject(root, true)
  const mixer = new AnimationMixer(model)
  const actions = new Map(source.animations.map((clip) => [clip.name, mixer.clipAction(clip)]))
  let active: AnimationAction | undefined
  return {
    root, model, materials, mixer, bounds: normalizedBounds,
    setAppearance(health: number, flowering: boolean, juvenile = false) {
      const dry = new Color('#b9a777')
      const pale = new Color('#cfceb0')
      materials.forEach((material, index) => {
        if (material.name.startsWith('Eyes')) { material.color.copy(baseColors[index]); return }
        material.color.copy(dry).lerp(baseColors[index], health)
        if (juvenile) material.color.lerp(pale, 0.45)
      })
      flowers.forEach((mesh) => { mesh.visible = flowering })
    },
    animate(name: 'idle' | 'walk' | 'eat', delta: number, speed: number) {
      if (shape.fallen) return
      const next = actions.get(name) ?? actions.get('idle')
      if (next && active !== next) {
        next.reset().fadeIn(0.16).play()
        active?.fadeOut(0.16)
        active = next
      }
      if (speed > 0) mixer.update(Math.min(delta, 0.05) * speed)
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
      materials.forEach((material) => material.dispose())
      model.traverse((object) => { if (object instanceof SkinnedMesh) object.skeleton.dispose() })
    },
  }
}
