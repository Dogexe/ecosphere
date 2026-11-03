import test from 'node:test'
import assert from 'node:assert/strict'
import {antFixture} from '../scripts/probe_ant_colony.mjs'
import {introduceColony,stepAntColony,antMaterialError,antPosition,nestRoute} from '../src/sim/colony.ts'
import {planExcavation,workExcavation,digRequired,growingRadius} from '../src/sim/excavation.ts'
import {parseSave,serializeSave} from '../src/sim/saves.ts'

export function spatialFixture() {
  const base=antFixture();delete base.colony
  const world=introduceColony(base,1.7,1.7)
  world.colony.ledger.introduced+=2-world.colony.food;world.colony.food=2
  return world
}
const step=w=>{const r=stepAntColony(w);return {...r,world:{...r.world,tick:w.tick+1}}}

test('new spatial graph is non-coplanar, routable and old graphs remain unchanged',()=>{
  const c=spatialFixture().colony, [o,a,b,d]=[c.nodes[2],c.nodes[3],c.nodes[4],c.nodes[5]]
  const v=p=>[p.x-o.x,p.y-o.y,p.z-o.z],u=v(a),vB=v(b),w=v(d)
  const volume=Math.abs(u[0]*(vB[1]*w[2]-vB[2]*w[1])-u[1]*(vB[0]*w[2]-vB[2]*w[0])+u[2]*(vB[0]*w[1]-vB[1]*w[0]))
  assert.ok(volume>0.005)
  for(const n of c.nodes)assert.ok(nestRoute(c,0,n.id).length)
  const old=antFixture();assert.deepEqual(parseSave(serializeSave(old)),old);assert.equal(old.colony.construction,undefined)
})

test('funded workers reach the face and excavate a connected functional resting chamber',()=>{
  let world=spatialFixture(), original=structuredClone(world), events=[], maximum=0
  for(let i=0;i<360;i++){
    const before=world, result=step(world);world=result.world;events.push(...result.events)
    assert.ok(Math.abs(antMaterialError(world.colony))<1e-9)
    for(const ant of world.colony.workers){const prior=before.colony.workers.find(a=>a.id===ant.id);if(prior){const a=antPosition(before.colony,prior),b=antPosition(world.colony,ant);maximum=Math.max(maximum,Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z))}}
    if(world.colony.construction.job?.work>0) {
      assert.deepEqual(step(parseSave(serializeSave(before))),result)
      assert.ok(world.colony.construction.removed>=world.colony.construction.job.work)
    }
    if(events.some(e=>e.action==='chamber'))break
  }
  assert.ok(events.some(e=>e.action==='excavation'))
  assert.ok(events.some(e=>e.action==='chamber'))
  assert.ok(world.colony.nodes.some(n=>n.role==='rest'))
  assert.ok(maximum<=0.14000001,maximum)
  assert.deepEqual(original,spatialFixture())
  for(const n of world.colony.nodes)assert.ok(nestRoute(world.colony,0,n.id).length)
  assert.deepEqual(parseSave(serializeSave(world)),world)
})

test('excavation requires actual arrival, reserve, soil and demand; work spends energy without making biomass',()=>{
  const w=spatialFixture(),c=w.colony;planExcavation(c,55,w.seed);assert.ok(c.construction.job)
  const job=c.construction.job, a=c.workers[0], before=c.construction.removed
  a.location={kind:'nest',from:3,to:3,progress:0}
  assert.equal(workExcavation(c,a,55,1,0.14).amount,0)
  a.location={kind:'nest',from:job.from,to:job.from,progress:0}
  for(const water of [0,20,88,100])assert.equal(workExcavation(c,a,water,1,0.14).amount,0)
  const energy=a.energy,material=antMaterialError(c), result=workExcavation(c,a,55,1,0.14)
  assert.ok(result.amount>0);assert.ok(a.energy<energy)
  assert.equal(c.construction.removed-before,result.amount);assert.equal(antMaterialError(c),material)
  const tip=c.nodes.find(n=>n.id===job.target.id);assert.ok(growingRadius(c,tip)>=0.085)
  for(const change of ['workers','food','water','capacity']){
    const world=spatialFixture(), colony=world.colony
    if(change==='workers')colony.workers=[]
    if(change==='food')colony.food=0
    if(change==='capacity')colony.nodes.push({id:10,x:2,y:-.7,z:2,role:'rest'})
    planExcavation(colony,change==='water'?5:55,world.seed)
    assert.equal(colony.construction.job,null,change)
  }
})

test('construction parser rejects impossible fronts and retains paused legacy construction opt-in',()=>{
  let w=spatialFixture();for(let i=0;i<20&&!w.colony.construction.job?.work;i++)w=step(w).world
  assert.ok(w.colony.construction.job?.work>0)
  const encoded=JSON.parse(serializeSave(w))
  for(const modify of [c=>c.construction.job.work=-1,c=>c.construction.removed=0,c=>c.construction.job.target.y=-5,c=>c.construction.job.target.id=0,c=>c.construction.job.from=999,c=>c.nodes.find(n=>n.id===c.construction.job.target.id).x+=.1]){
    const copy=structuredClone(encoded);modify(copy.world.colony);assert.throws(()=>parseSave(JSON.stringify(copy)))
  }
  w.colony.construction.enabled=false
  const saved=parseSave(serializeSave(w));assert.deepEqual(saved,w)
  assert.deepEqual(step(saved),step(w))
})

test('an extending tip cannot advect other workers or erase unpaid builder offsets',()=>{
  const w=spatialFixture(),c=w.colony;planExcavation(c,55,w.seed)
  const a=c.workers[0], job=c.construction.job
  a.energy=90;a.location={kind:'nest',from:job.from,to:job.from,progress:0}
  for(let i=0;i<4;i++)workExcavation(c,a,55,1,0.14)
  const tip=job.target.id
  c.workers[1].location={kind:'nest',from:job.from,to:tip,progress:0.2}
  c.workers[2].location={kind:'nest',from:tip,to:job.from,progress:0.6}
  c.workers[3].location={kind:'nest',from:tip,to:tip,progress:0,offset:{x:.01,y:.01,z:0}}
  const positions=c.workers.map(other=>antPosition(c,other))
  assert.ok(workExcavation(c,a,55,1,.14).amount>0)
  for(let i=1;i<c.workers.length;i++)assert.ok(Math.hypot(...Object.keys(positions[i]).map(key=>antPosition(c,c.workers[i])[key]-positions[i][key]))<1e-9)
  a.location.offset={x:0,y:.01,z:0}
  assert.equal(workExcavation(c,a,55,1,.14).amount,0)
  assert.doesNotThrow(()=>parseSave(serializeSave(w)))
})

test('a saved pending front cannot exceed graph caps on its next step',()=>{
  const w=spatialFixture(),c=w.colony;planExcavation(c,55,w.seed);c.construction.job.target.id=12
  for(let id=6;id<12;id++){c.nodes.push({id,x:1.76+Math.cos(id)*.1,y:-.6,z:1.7+Math.sin(id)*.1,role:'junction'});c.edges.push([2,id])}
  assert.throws(()=>parseSave(serializeSave(w)))
  const ant=c.workers[0];ant.location={kind:'nest',from:2,to:2,progress:0}
  assert.equal(workExcavation(c,ant,55,1,.14).amount,0)
})

test('completed refuges are used for rest and loss of crowding suspends an active build',()=>{
  let world=spatialFixture()
  for(let i=0;i<360&&!world.colony.nodes.some(n=>n.role==='rest');i++)world=step(world).world
  const room=world.colony.nodes.find(n=>n.role==='rest');assert.ok(room)
  let used=false
  for(let i=0;i<45;i++){
    world=stepAntColony(world,{temperatureC:22,solar:0,cycling:true}).world
    used ||= world.colony.workers.some(a=>a.activity==='resting'&&a.goal?.id===room.id)
  }
  assert.ok(used)
  const w=spatialFixture(), c=w.colony;planExcavation(c,55,w.seed);const ant=c.workers[0];ant.location={kind:'nest',from:2,to:2,progress:0}
  c.workers=c.workers.slice(0,2)
  assert.equal(workExcavation(c,ant,55,1,.14).amount,0)
})
