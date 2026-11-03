import { writeFileSync } from 'node:fs'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { simulateStep } from '../src/sim/ecosystem.ts'
import { antMaterialError, antPosition, introduceColony, seedMaterialAvailable } from '../src/sim/colony.ts'
import { parseSave, serializeSave } from '../src/sim/saves.ts'
import assert from 'node:assert/strict'

const rows = [], checkpoint = new Set()
for (const habitat of ['garden', 'meadow', 'woodland']) for (const seed of [17, 183, 2217]) for (const cycling of [false, true]) for (const site of [[1.7,1.7],[-1.7,-1.7]]) {
  const base = createHabitatWorld(habitat, seed)
  let control = cycling ? beginDaylitWorld(base) : base
  let world = introduceColony(control, ...site)
  if (!world.colony) continue
  const counts = {}, tasks = {}, samples = []
  let edibleHours = 0, sourceTotal = 0, hungryCarry = 0, strandedNurse = 0, unspent = 0, maxError = 0, queenLost = null
  for (let i=0;i<720;i++) {
    const colony = world.colony, available = world.plants.reduce((sum,p)=>sum+seedMaterialAvailable(p),0)
    if (available > .001) edibleHours++
    sourceTotal += available
    for (const a of colony.workers) {
      tasks[a.activity] = (tasks[a.activity]??0)+1
      if(a.energy<20&&a.gut<.001&&a.carried>.003) {
        hungryCarry++
        if(!checkpoint.has('hungry')) {writeFileSync('artifacts/ant-needs-hungry-before.json',serializeSave(world));checkpoint.add('hungry')}
      }
      if(a.activity==='nursing'&&a.carried>.001&&a.location.kind==='nest'&&a.location.from===a.location.to&&colony.nodes.find(n=>n.id===a.location.from)?.role==='brood'&&!colony.brood.some(b=>b.stage==='larva'&&b.material<b.count*.039)&&colony.queen?.gut>=.008) strandedNurse++
    }
    if(colony.queen?.energy<20&&colony.food>.02)unspent++
    const result=simulateStep(world)
    world=result.world;control=simulateStep(control).world
    for(const event of result.events)if(event.type==='ant')counts[event.action]=(counts[event.action]??0)+1
    maxError=Math.max(maxError,Math.abs(antMaterialError(world.colony)))
    if(queenLost===null&&!world.colony.queen)queenLost=i+1
    if(i%120===0){assert.deepEqual(simulateStep(parseSave(serializeSave(world))),simulateStep(world));samples.push({hour:i,edible:available,food:colony.food,queen:colony.queen?.energy,workers:colony.workers.length})}
  }
  rows.push({habitat,seed,cycling,site,counts,edibleHours,meanEdible:sourceTotal/720,hungryCarry,strandedNurse,unspent,queenLost,workers:world.colony.workers.length,food:world.colony.food,plants:world.plants.length,controlPlants:control.plants.length,maxError,tasks,samples})
}
const name=process.argv[2]??'before'
writeFileSync(`artifacts/ant-needs-${name}.json`,JSON.stringify(rows,null,2))
console.log({name,cases:rows.length,alive:rows.filter(r=>r.queenLost===null).length,births:rows.reduce((n,r)=>n+(r.counts.birth??0),0),hungryCarry:rows.reduce((n,r)=>n+r.hungryCarry,0),strandedNurse:rows.reduce((n,r)=>n+r.strandedNurse,0),hungryQueenWithStores:rows.reduce((n,r)=>n+r.unspent,0),maxError:Math.max(...rows.map(r=>r.maxError))})
console.log(rows.map(r=>({habitat:r.habitat,seed:r.seed,cycle:r.cycling,site:r.site[0],harvest:r.counts.harvest??0,birth:r.counts.birth??0,edibleHours:r.edibleHours,dead:r.queenLost,workers:r.workers,stuck:r.strandedNurse})))
