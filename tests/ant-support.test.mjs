import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, Matrix4, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { antSupportOffset, antSupportTranslation } from '../src/scene/antSupport.ts'
import { prepareField, nestFrame } from '../src/scene/nestGeometry.ts'
import { createWorld } from '../src/sim/ecosystem.ts'
import { introduceColony } from '../src/sim/colony.ts'

test('imported workers fit real three-dimensional routes in both directions at juvenile and adult scale', async () => {
  const colony = introduceColony(createWorld(2217), 1.7, 1.7).colony
  const original = structuredClone(colony), field = prepareField(colony)
  const bytes = readFileSync('public/assets/organisms/ant-worker.glb')
  const source = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const model = instantiateOrganism(source, { length: .115, base: 0 })
  const bounds = model.bounds.clone().expandByScalar(.012)
  for (const [aId,bId] of colony.edges) {
    const a = colony.nodes.find(n=>n.id===aId), b = colony.nodes.find(n=>n.id===bId)
    for (const direction of [-1,1]) {
      const forward = new Vector3(b.x-a.x,b.y-a.y,b.z-a.z).normalize().multiplyScalar(direction)
      const up = Math.abs(forward.y)<.92 ? new Vector3(0,1,0) : nestFrame(colony).normal
      const right = up.clone().cross(forward).normalize()
      const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,forward.clone().cross(right),forward))
      const midpoint = new Vector3(a.x,a.y,a.z).lerp(new Vector3(b.x,b.y,b.z),.5)
      const pair = [-.0449,.0449].map(lateral => {
        const origin = midpoint.clone().addScaledVector(right,lateral)
        return origin.clone().add(antSupportTranslation(field,origin,rotation,bounds,1,colony).applyQuaternion(rotation))
      })
      assert.ok(pair[0].distanceTo(pair[1]) > .01, 'wall recovery must not collapse separated workers onto one point')
      for (const scale of [.7,1]) for (let step=0;step<=20;step++) for (const lateral of [-.0449,0,.0449]) {
        const origin = new Vector3(a.x,a.y,a.z).lerp(new Vector3(b.x,b.y,b.z),step/20).addScaledVector(right,lateral)
        const depth = antSupportOffset(field,origin,rotation,bounds,scale)
        assert.ok(Number.isFinite(depth) && depth<=0 && depth>=-.305)
        model.root.scale.setScalar(scale); model.root.quaternion.copy(rotation)
        const correction = antSupportTranslation(field,origin,rotation,bounds,scale,colony)
        assert.ok(correction.length() < .4)
        model.root.position.copy(origin).add(correction.applyQuaternion(rotation))
        model.animate('walk',1/30,1); model.root.updateMatrixWorld(true)
        model.model.traverse(mesh=> {
          if (!(mesh instanceof SkinnedMesh)) return
          mesh.skeleton.update()
          for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
            const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld)
            assert.ok(field(p.x,p.y,p.z)<.001, `edge ${aId}/${bId} step ${step} scale ${scale}`)
          }
        })
      }
    }
  }
  assert.deepEqual(colony,original)
  model.dispose()
})

test('support finds the first wall without crossing soil to a deeper disconnected cavity', () => {
  const box = new Box3(new Vector3(-.02, 0, -.04), new Vector3(.02, .04, .04))
  const origin = new Vector3(), rotation = new Quaternion()
  const field = (x,y,z) => Math.min(Math.hypot(x,y,z)-.17, Math.hypot(x,y+.4,z)-.17)
  const original = box.clone()
  const offset = antSupportOffset(field, origin, rotation, box, 1)
  assert.ok(offset < -.14 && offset > -.17)
  assert.deepEqual(box, original)
  assert.deepEqual(origin, new Vector3())
  assert.equal(antSupportOffset(()=>1, origin, rotation, box,1),0)
})

globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }
test('actual animated caste vertices clear room floors at support depth without changing size', async () => {
  for (const [caste,length,radius] of [['worker',.115,.17],['queen',.2,.2]]) {
    const bytes = readFileSync(`public/assets/organisms/ant-${caste}.glb`)
    const source = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
    const model = instantiateOrganism(source,{length,base:0})
    const envelope = model.bounds.clone().expandByScalar(.012)
    const field=(x,y,z)=>Math.hypot(x/1.16,y,z/1.06)-radius
    const depth=antSupportOffset(field,new Vector3(),new Quaternion(),envelope,1)
    assert.ok(depth < -.055, 'room support must improve fixed hovering offset')
    model.root.position.y=depth
    for(const clip of ['idle','walk','eat']) for(let i=0;i<60;i++) {
      model.animate(clip,1/30,1)
      model.root.updateMatrixWorld(true)
      model.model.traverse(mesh=> {
        if(!(mesh instanceof SkinnedMesh))return
        mesh.skeleton.update()
        for(let index=0;index<mesh.geometry.attributes.position.count;index++) {
          const p=mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld)
          assert.ok(field(p.x,p.y,p.z)<.001,`${caste}/${clip} inside room`)
        }
      })
    }
    model.dispose()
  }
})
