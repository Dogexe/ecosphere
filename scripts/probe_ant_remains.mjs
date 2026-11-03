import{writeFileSync}from'node:fs'
import{antFixture}from'./probe_ant_colony.mjs'
import{introduceColony,antPosition,antMaterialError}from'../src/sim/colony.ts'
import{simulateStep}from'../src/sim/ecosystem.ts'
import{serializeSave,parseSave}from'../src/sim/saves.ts'
import assert from'node:assert/strict'
const base=antFixture();delete base.colony
let w=introduceColony(base,1.7,1.7);w.climate.photoperiod=true;w.climate.rainfall=.55
w.colony.workers[0].age=1199;w.colony.workers[0].location={kind:'nest',from:4,to:5,progress:.4}
writeFileSync('artifacts/ant-remains-live-before.json',serializeSave(w))
w=simulateStep(w).world;writeFileSync('artifacts/ant-remains-live-after.json',serializeSave(w))
let corpse=w.remains.find(r=>r.ant?.sourceId===1);const initial=corpse.material, y=corpse.ant.y, samples=[]
for(let i=0;i<180;i++){w=simulateStep(w).world;corpse=w.remains.find(r=>r.ant?.sourceId===1);if(i%12===0)samples.push({tick:w.tick,material:corpse?.material??0});if(i%23===0)assert.deepEqual(simulateStep(parseSave(serializeSave(w))),simulateStep(w));assert.ok(Math.abs(antMaterialError(w.colony))<1e-9)}
assert.ok(samples[1].material<initial);console.log({initial,y,samples})
writeFileSync('artifacts/ant-remains-cycle-report.json',JSON.stringify({initial,y,samples},null,2))
