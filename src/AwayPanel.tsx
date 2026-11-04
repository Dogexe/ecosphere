import { useEffect, useRef } from 'react'
import { awayDuration, awayLines } from './sim/away'
import type { AwayReport } from './sim/away'

type Props = { report: AwayReport | null; onClose: () => void; onWatch: () => void; onObserve: () => void }

/** The notebook page that greets the player after the jar lived on without them. */
export function AwayPanel({ report, onClose, onWatch, onObserve }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!report) { dialog.current?.close(); return }
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [report])

  return (
    <dialog ref={dialog} className="experiment-dialog away-dialog" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }} aria-labelledby="away-title">
      {report && <div className="experiment-content">
        <div className="experiment-heading"><span className="eyebrow">WHILE YOU WERE AWAY</span><form method="dialog"><button className="dialog-close" type="submit" aria-label="Close">×</button></form></div>
        <h2 id="away-title">{awayDuration(report.hours)} passed in the jar.</h2>
        <dl className="seal-readout away-readout">
          <div><dt>Plants</dt><dd>{report.plants.before} → {report.plants.after}</dd></div>
          <div><dt>Animals</dt><dd>{report.animals.before} → {report.animals.after}</dd></div>
          <div><dt>Soil water</dt><dd>{Math.round(report.soilWater.before)} → {Math.round(report.soilWater.after)}</dd></div>
        </dl>
        <ul className="away-notes">{awayLines(report).map((line) => <li key={line}>{line}</li>)}</ul>
        <p className="storage-note">The jar lives one hour for every real hour you are away, by the same rules as when you watch. The Observatory graphs include the time you were gone.</p>
        <div className="import-actions">
          <button className="save-experiment" type="button" onClick={onObserve}>See the graphs</button>
          <button className="load-experiment" type="button" autoFocus onClick={onWatch}>Watch it live</button>
        </div>
      </div>}
    </dialog>
  )
}
