import {writeFileSync}from'node:fs'
import {createHabitatWorld}from'../src/sim/habitats.ts'
import {beginDaylitWorld}from'../src/sim/climate.ts'
import {introduceLife,simulateStep,interveneAt}from'../src/sim/ecosystem.ts'
import {introduceColony,seedMaterialAvailable}from'../src/sim/colony.ts'
const results=[]
for(const seed of[17,183,2217])for(const mature of[false,true])for(const site of[[1.7,1.7],[.7,-1.7]]){
 let w=beginDaylitWorld(createHabitatWorld('bare',seed));w.climate.rainfall=.55;w.light=.92
 for(const [kind,dx,dz]of[['clover',-.6,0],['grass',.6,0],['clover',0,-.6],['grass',0,.6]])w=introduceLife(w,kind,site[0]+dx,site[1]+dz)
 if(mature)w={...w,plants:w.plants.map(p=>({...p,biomass:p.capacity*.8,development:90,age:90}))}
 w=introduceColony(w,...site);let counts={},death=null,samples=[]
 for(let i=0;i<960;i++){
  if(i%48===0)for(const p of w.soil){if(p.water<40)w=interveneAt(w,'water',p.id);if(p.nutrients<20)w=interveneAt(w,'compost',p.id)}
  let r=simulateStep(w);w=r.world;for(const e of r.events)if(e.type==='ant')counts[e.action]=(counts[e.action]??0)+1
  if(!w.colony.queen&&death===null)death=i
  if(i%120===0)samples.push({i,queen:w.colony.queen?.energy,food:w.colony.food,workers:w.colony.workers.map(a=>[a.id,a.activity,a.energy]),edible:w.plants.reduce((s,p)=>s+seedMaterialAvailable(p),0)})
 }
 results.push({seed,mature,site,counts,death,workers:w.colony.workers.length,food:w.colony.food,samples})
}
writeFileSync('artifacts/ant-needs-local-plots.json',JSON.stringify(results,null,2));console.log(results.map(({samples,...r})=>r))
