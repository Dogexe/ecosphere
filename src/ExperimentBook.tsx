import { useEffect, useRef, useState } from 'react'
import { creatureCounts, vitality } from './sim/ecosystem'
import type { World } from './sim/ecosystem'
import { parseSave, serializeSave } from './sim/saves'
import { readWorldFile, worldFileName } from './experimentFiles'

type Slot = { world: World | null; error: string | null }
type FilePreview = { world: World; name: string; request: number }
type Props = { open: boolean; world: World; onClose: () => void; onLoad: (world: World) => void }
const keys = ['ecosphere.experiment.a', 'ecosphere.experiment.b']
const emptySlots: Slot[] = [{ world: null, error: null }, { world: null, error: null }]

export function ExperimentBook({ open, world, onClose, onLoad }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [slots, setSlots] = useState(emptySlots)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const readRequest = useRef(0)
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [fileMessage, setFileMessage] = useState('')

  function resetImport() {
    readRequest.current += 1
    setFilePreview(null)
    setReadingFile(false)
    setFileMessage('')
  }

  useEffect(() => {
    resetImport()
    if (!open) { dialog.current?.close(); return }
    setMessage('')
    setSlots(keys.map((key): Slot => {
      try {
        const saved = window.localStorage.getItem(key)
        return { world: saved ? parseSave(saved) : null, error: null }
      } catch (error) {
        return { world: null, error: error instanceof DOMException ? 'This browser is not allowing saved experiments.' : error instanceof Error ? error.message : 'Browser storage is unavailable.' }
      }
    }))
    dialog.current?.showModal()
    return () => { readRequest.current += 1 }
  }, [open])

  function save(index: number) {
    try {
      const encoded = serializeSave(world)
      const snapshot = parseSave(encoded)
      window.localStorage.setItem(keys[index], encoded)
      setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { world: snapshot, error: null } : slot))
      setMessage(`Experiment ${index === 0 ? 'A' : 'B'} is safely kept in this browser.`)
    } catch {
      setMessage('This browser could not save here. Download a world file to keep this experiment; your live world is still here.')
    }
  }

  function downloadWorld() {
    let url: string | null = null
    let link: HTMLAnchorElement | null = null
    try {
      const encoded = serializeSave(world)
      parseSave(encoded)
      url = URL.createObjectURL(new Blob([encoded], { type: 'application/json' }))
      link = document.createElement('a')
      link.href = url
      link.download = worldFileName(world)
      document.body.appendChild(link)
      link.click()
      setMessage('World file requested. Keep it in Downloads or Files, then open it on another device to continue.')
    } catch {
      setMessage('This browser could not create a world file. Your live world and kept experiments are still here.')
    } finally {
      link?.remove()
      const downloadUrl = url
      if (downloadUrl) window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000)
    }
  }

  async function prepareFile(file: File) {
    const request = ++readRequest.current
    setFilePreview(null)
    setReadingFile(true)
    setFileMessage('Reading world file…')
    try {
      const snapshot = await readWorldFile(file)
      if (request !== readRequest.current) return
      setFilePreview({ world: snapshot, name: file.name, request })
      setFileMessage('File checked. Review this world before opening it.')
    } catch (error) {
      if (request === readRequest.current) setFileMessage(error instanceof Error ? error.message : 'This world file could not be read.')
    } finally {
      if (request === readRequest.current) setReadingFile(false)
    }
  }

  function openImportedWorld() {
    if (!filePreview || readingFile || filePreview.request !== readRequest.current) return
    readRequest.current += 1
    onLoad(filePreview.world)
    dialog.current?.close()
  }

  return (
    <dialog ref={dialog} className="experiment-dialog" onClose={() => { resetImport(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }} aria-labelledby="experiment-title">
      <div className="experiment-content">
        <div className="experiment-heading"><span className="eyebrow">YOUR FIELD BOOK</span><form method="dialog"><button className="dialog-close" autoFocus type="submit" aria-label="Close experiments">×</button></form></div>
        <h2 id="experiment-title">Keep a little possibility.</h2>
        <p className="experiment-intro">Save a moment, change the conditions, and return to try another path. Time is paused.</p>
        <div className="current-snapshot">CURRENT WORLD <strong>Day {Math.floor(world.tick / 24) + 1} · {String(world.tick % 24).padStart(2, '0')}:00 · {world.plants.length} plants · {world.creatures.length + (world.colony?.workers.length ?? 0) + (world.colony?.queen ? 1 : 0)} animals</strong></div>
        {world.colony && <p className="storage-note">Ant colony · {world.colony.workers.length} workers · {world.colony.brood.reduce((sum, cohort) => sum + cohort.count, 0)} developing young</p>}
        <div className="file-transfer" role="group" aria-label="Portable world files">
          <button className="save-experiment" type="button" onClick={downloadWorld}>Download current world</button>
          <button className="save-experiment" type="button" onClick={() => fileInput.current?.click()}>{readingFile ? 'Choose another file' : 'Open world file'}</button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Choose an ECOSPHERE world file" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void prepareFile(file) }} />
        </div>
        {fileMessage && <p className="experiment-message" role="status">{fileMessage}</p>}
        {filePreview && <article className="file-preview" aria-label="Imported world preview">
          <span className="slot-label">FROM A WORLD FILE</span><strong>{filePreview.name}</strong>
          <p>Day {Math.floor(filePreview.world.tick / 24) + 1} · {String(filePreview.world.tick % 24).padStart(2, '0')}:00 · {filePreview.world.plants.length} plants · {filePreview.world.creatures.length + (filePreview.world.colony?.workers.length ?? 0) + (filePreview.world.colony?.queen ? 1 : 0)} animals</p>
          {filePreview.world.colony && <p>Ant colony · {filePreview.world.colony.workers.length} workers · {filePreview.world.colony.queen ? 'queen alive' : 'queen lost'}</p>}
          <small>Opens paused. Your unsaved run will be replaced; experiments A and B stay kept.</small>
          <div className="import-actions"><button className="save-experiment" type="button" onClick={resetImport}>Keep current world</button><button className="load-experiment" type="button" onClick={openImportedWorld}>Open imported world</button></div>
        </article>}
        <div className="experiment-slots">
          {slots.map((slot, index) => {
            const snapshot = slot.world
            const counts = snapshot ? creatureCounts(snapshot.creatures) : null
            return (
              <article className="experiment-slot" key={keys[index]}>
                <div className="slot-label">EXPERIMENT {index === 0 ? 'A' : 'B'}</div>
                {snapshot ? <>
                  <h3>Day {Math.floor(snapshot.tick / 24) + 1}<span>{String(snapshot.tick % 24).padStart(2, '0')}:00</span></h3>
                  <dl>
                    <div><dt>Plants</dt><dd>{snapshot.plants.length}</dd></div>
                    <div><dt>Grazers</dt><dd>{counts?.grazer}</dd></div>
                    <div><dt>Woodlice</dt><dd>{counts?.woodlouse}</dd></div>
                    <div><dt>Beetles</dt><dd>{counts?.beetle}</dd></div>
                    <div><dt>Springtails</dt><dd>{counts?.springtail}</dd></div>
                    <div><dt>Water fleas</dt><dd>{counts?.flea}</dd></div>
                    <div><dt>Fish</dt><dd>{counts?.fish}</dd></div>
                    {snapshot.colony && <div><dt>Ant workers</dt><dd>{snapshot.colony.workers.length}</dd></div>}
                    <div><dt>Pond oxygen</dt><dd>{Math.round(snapshot.pond.oxygen / Math.max(1, snapshot.pond.water) * 100)}%</dd></div>
                    <div><dt>Leaf cover</dt><dd>{Math.round(vitality(snapshot) * 100)}%</dd></div>
                    <div><dt>Soil water</dt><dd>{Math.round(snapshot.water)}%</dd></div>
                    <div><dt>{snapshot.climate.photoperiod ? 'Peak daylight' : 'Sunlight'}</dt><dd>{Math.round(snapshot.light * 100)}%</dd></div>
                    <div><dt>Light regime</dt><dd>{snapshot.climate.photoperiod ? 'Day & night' : 'Constant'}</dd></div>
                    <div><dt>Warmth baseline</dt><dd>{snapshot.climate.temperatureC}°C</dd></div>
                  </dl>
                  <button className="load-experiment" onClick={() => { onLoad(snapshot); dialog.current?.close() }} type="button">Explore this world <span aria-hidden="true">↗</span></button>
                </> : <div className="empty-experiment"><span aria-hidden="true">✳</span><p>{slot.error ? 'This snapshot could not be opened.' : 'A place for your next experiment.'}</p>{slot.error && <small>{slot.error}</small>}</div>}
                <button className="save-experiment" onClick={() => save(index)} type="button">{snapshot || slot.error ? 'Replace with current world' : 'Save current world here'}</button>
              </article>
            )
          })}
        </div>
        {message && <p className="experiment-message" role="status">{message}</p>}
        <p className="storage-note">Kept on this browser and address. Other devices have their own field book. <a href={`${import.meta.env.BASE_URL}assets/organisms/CREDITS.txt`} target="_blank" rel="noreferrer">Art credits</a></p>
      </div>
    </dialog>
  )
}
