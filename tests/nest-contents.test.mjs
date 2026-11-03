import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Matrix4, Quaternion, Vector3, SkinnedMesh, Mesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createWorld } from '../src/sim/ecosystem.ts'
import { introduceColony } from '../src/sim/colony.ts'
import { nestFrame, prepareField } from '../src/scene/nestGeometry.ts'
import { instantiateOrganism } from '../src/scene/organismModel.ts'
import { eggBounds, grainBounds, nestContentOffset, nurseryOrigin } from '../src/scene/nestContents.ts'

globalThis.ProgressEvent ??= class extends Event { constructor(type, values) { super(type); Object.assign(this, values) } }

test('imported nursery contents settle world-down without resizing or entering soil', async () => {
  const colony = introduceColony(createWorld(2217),1.7,1.7).colony
  const original = structuredClone(colony), field = prepareField(colony), frame = nestFrame(colony)
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(frame.normal.clone().cross(frame.right),frame.normal,frame.right))
  const room = colony.nodes.find(n=>n.role==='brood')
  for (const [kind,length] of [['larva',.035],['larva',.065],['pupa',.08]]) {
    const bytes=readFileSync(`public/assets/organisms/ant-${kind}.glb`)
    const source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
    const model=instantiateOrganism(source,{length,base:-.055}), bounds=model.bounds.clone()
    for (let index=0;index<8;index++) for (const count of [1,3]) {
      const origin=nurseryOrigin(room,index)
      const floor=nestContentOffset(field,origin,bounds,rotation,count)
      assert.ok(floor<0 && floor>-.305, `${kind}/${length}/${index}/${count}: ${floor}`)
      for(let i=0;i<count;i++) {
        model.root.quaternion.copy(rotation); model.root.position.copy(origin);model.root.position.y+=floor+i*.017
        model.root.updateMatrixWorld(true)
        model.model.traverse(mesh=> {
          if(!(mesh instanceof Mesh))return
          if(mesh instanceof SkinnedMesh)mesh.skeleton.update()
          for(let j=0;j<mesh.geometry.attributes.position.count;j++) {
            const p=mesh.getVertexPosition(j,new Vector3()).applyMatrix4(mesh.matrixWorld)
            assert.ok(field(p.x,p.y,p.z)<0,`${kind} cohort ${index}/${count}`)
          }
        })
      }
      assert.deepEqual(model.bounds,bounds)
    }
    model.dispose()
  }
  assert.deepEqual(colony,original)
})

test('all eight normal cohort slots remain separately selectable after settling', () => {
  const colony=introduceColony(createWorld(2217),1.7,1.7).colony,field=prepareField(colony)
  const room=colony.nodes.find(n=>n.role==='brood')
  const positions=Array.from({length:8},(_,i)=> {
    const p=nurseryOrigin(room,i)
    p.y+=nestContentOffset(field,p,eggBounds,new Quaternion())
    return p
  })
  for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)
    assert.ok(positions[i].distanceTo(positions[j])>=.049)
})

test('existing eggs and grain bounds stay inside the room at their supported floor', () => {
  const colony=introduceColony(createWorld(2217),1.7,1.7).colony,field=prepareField(colony)
  for(const [role,bounds] of [['brood',eggBounds],['food',grainBounds]]) {
    const room=colony.nodes.find(n=>n.role===role), origin=new Vector3(room.x,room.y-.035,room.z)
    const before=bounds.clone(), floor=nestContentOffset(field,origin,bounds,new Quaternion())
    assert.ok(floor<-.06)
    for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z])
      assert.ok(field(origin.x+x,origin.y+y+floor,origin.z+z)<0)
    assert.deepEqual(bounds,before)
  }
})



