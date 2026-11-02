import {writeFileSync}from'node:fs'
import assert from'node:assert/strict'
import{antFixture}from'./probe_ant_colony.mjs'
import{beginDaylitWorld}from'../src/sim/climate.ts'
import{simulateStep}from'../src/sim/ecosystem.ts'
import{serializeSave,parseSave}from'../src/sim/saves.ts'
import{antMaterialError,introduceColony}from'../src/sim/colony.ts'
const base=antFixture();delete base.colony
let world=beginDaylitWorld(introduceColony(base,1.7,1.7));world.climate.rainfall=.55
writeFileSync('artifacts/ant-needs-spatial-cycle-start.json',serializeSave(world))
const counts={},first={};let maxError=0
for(let i=0;i<720;i++){
 const before=world,r=simulateStep(world);world=r.world
 for(const e of r.events){if(e.type!=='ant')continue;counts[e.action]=(counts[e.action]??0)+1;if(first[e.action]===undefined){first[e.action]=world.tick;writeFileSync(`artifacts/ant-needs-spatial-${e.action}-before.json`,serializeSave(before));writeFileSync(`artifacts/ant-needs-spatial-${e.action}-after.json`,serializeSave(world))}}
 maxError=Math.max(maxError,Math.abs(antMaterialError(world.colony)))
 if(i%24===0)assert.deepEqual(simulateStep(parseSave(serializeSave(world))),simulateStep(world))
}
assert.ok(counts.birth>0)
const report={counts,first,maxError,workers:world.colony.workers.length,queen:!!world.colony.queen,food:world.colony.food}
writeFileSync('artifacts/ant-needs-spatial-cycle-report.json',JSON.stringify(report,null,2));console.log(report)
