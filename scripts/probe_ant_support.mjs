import { writeFileSync } from 'node:fs'
import { createHabitatWorld } from '../src/sim/habitats.ts'
import { beginDaylitWorld } from '../src/sim/climate.ts'
import { simulateStep, interveneAt } from '../src/sim/ecosystem.ts'
import { introduceColony, seedMaterialAvailable } from '../src/sim/colony.ts'
const rows=[]
for(const site of [[1.7,1.7],[-1.7,-1.7],[.7,-1.7]])for(const cycling of[false,true])for(const herbivores of[false,true])for(const tended of[false,true]){
 let base=createHabitatWorld('meadow',2217)
 if(!herbivores)base={...base,creatures:base.creatures.filter(a=>a.kind!=='grazer')}
 if(cycling)base=beginDaylitWorld(base)
 let w=introduceColony(base,...site),events={},maxNear=0,maxFood=0,samples=[]
 if(!w.colony)continue
 for(let i=0;i<960;i++){
  if(tended&&i%48===0){for(const p of w.soil){if(p.water<40)w=interveneAt(w,'water',p.id);if(p.nutrients<20)w=interveneAt(w,'compost',p.id)}}
  maxNear=Math.max(maxNear,w.plants.filter(p=>Math.hypot(p.x-site[0],p.z-site[1])<1).reduce((s,p)=>s+seedMaterialAvailable(p),0))
  const r=simulateStep(w);w=r.world;for(const e of r.events)if(e.type==='ant')events[e.action]=(events[e.action]??0)+1
  maxFood=Math.max(maxFood,w.colony.food)
  if(i%120===0)samples.push({i,food:w.colony.food,edibles:w.plants.reduce((s,p)=>s+seedMaterialAvailable(p),0),water:w.water,workers:w.colony.workers.length})
 }
 rows.push({site,cycling,herbivores,tended,events,maxNear,maxFood,queen:!!w.colony.queen,workers:w.colony.workers.length,samples})
}
const name=process.argv[2]??'current';writeFileSync(`artifacts/ant-needs-suitable-${name}.json`,JSON.stringify(rows,null,2));console.log({name,cases:rows.length,alive:rows.filter(r=>r.queen).length,births:rows.reduce((n,r)=>n+(r.events.birth??0),0),cycled:rows.filter(r=>r.cycling&&r.tended).map(r=>({site:r.site,herbivores:r.herbivores,queen:r.queen,workers:r.workers,birth:r.events.birth??0,harvest:r.events.harvest??0}))})
