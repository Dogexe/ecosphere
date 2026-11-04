import { useEffect, useRef, useState } from 'react'
import { entryDay, entryTime, pageById, pages, progress } from './sim/notebook'
import type { Notebook, PageKind } from './sim/notebook'

type Props = { open: boolean; notebook: Notebook; focusPage: string | null; onClose: () => void; onWrite: (text: string) => void }

const sections: { kind: PageKind; title: string }[] = [
  { kind: 'species', title: 'Who lives here' },
  { kind: 'behaviour', title: 'Things I saw them do' },
  { kind: 'jar', title: 'The jar itself' },
]
const dateLabel = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * The field notebook: every page is something the player actually saw in the
 * jar, with a real-world note and its sources. Blank pages say where to look.
 */
export function FieldNotebook({ open, notebook, focusPage, onClose, onWrite }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<'pages' | 'journal'>('pages')
  const [page, setPage] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    if (focusPage) { setTab('pages'); setPage(focusPage) }
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [open, focusPage])

  const total = progress(notebook)
  const shown = page ? pageById.get(page) : null
  const found = shown ? notebook.found[shown.id] : null
  const journal = [...notebook.journal].reverse()

  return (
    <dialog ref={dialog} className="experiment-dialog notebook-dialog" onClose={() => { setPage(null); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }} aria-labelledby="notebook-title">
      <div className="experiment-content">
        <div className="experiment-heading"><span className="eyebrow">FIELD NOTEBOOK · {total.found} OF {total.total} PAGES</span><form method="dialog"><button className="dialog-close" type="submit" aria-label="Close">×</button></form></div>
        <div className="notebook-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'pages'} className={tab === 'pages' ? 'active' : ''} onClick={() => { setTab('pages'); setPage(null) }}>Pages</button>
          <button type="button" role="tab" aria-selected={tab === 'journal'} className={tab === 'journal' ? 'active' : ''} onClick={() => setTab('journal')}>Journal</button>
        </div>

        {tab === 'pages' && shown && (
          <article className="notebook-page">
            <button className="back-link" type="button" onClick={() => setPage(null)}>← All pages</button>
            <h2 id="notebook-title">{found ? shown.title : 'A blank page'}</h2>
            {found ? <>
              {(shown.latin || shown.size) && <p className="notebook-latin">{shown.latin && <em>{shown.latin}</em>}{shown.latin && shown.size && ' · '}{shown.size}</p>}
              <p className="notebook-note">{shown.note}</p>
              {shown.inJar && <p className="notebook-injar"><strong>In this jar:</strong> {shown.inJar}</p>}
              <p className="notebook-stamp">First seen {found.away ? 'while you were away, ' : ''}on day {entryDay(found)} at {entryTime(found)} · {dateLabel(found.at)}</p>
              <div className="notebook-sources"><span>Sources</span><ul>{shown.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul></div>
            </> : <p className="notebook-note">{shown.hint}</p>}
          </article>
        )}

        {tab === 'pages' && !shown && <>
          <h2 id="notebook-title">What I have seen in the jar.</h2>
          {sections.map(({ kind, title }) => {
            const count = progress(notebook, kind)
            return (
              <section key={kind} className="notebook-section">
                <h3>{title} <span>{count.found}/{count.total}</span></h3>
                <div className="notebook-grid">
                  {pages.filter((item) => item.kind === kind).map((item) => {
                    const seen = !!notebook.found[item.id]
                    return (
                      <button key={item.id} type="button" className={`notebook-card ${seen ? 'seen' : 'blank'}`} onClick={() => setPage(item.id)}>
                        <strong>{seen ? item.title : '?'}</strong>
                        <small>{seen ? item.latin ?? `Day ${entryDay(notebook.found[item.id])}` : item.hint}</small>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </>}

        {tab === 'journal' && <>
          <h2 id="notebook-title">Journal</h2>
          <form className="notebook-write" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { onWrite(draft); setDraft('') } }}>
            <textarea value={draft} maxLength={500} rows={2} placeholder="Write what you noticed…" aria-label="Write a note" onChange={(event) => setDraft(event.target.value)} />
            <button className="save-experiment" type="submit" disabled={!draft.trim()}>Add note</button>
          </form>
          {journal.length === 0 ? <p className="experiment-intro">Nothing written yet. Let time run and watch; the notebook writes down what happens.</p> : (
            <ol className="notebook-journal">
              {journal.map((entry, index) => {
                const newDate = index === 0 || dateLabel(journal[index - 1].at) !== dateLabel(entry.at)
                return (
                  <li key={`${entry.at}:${index}`} className={`entry-${entry.kind}`}>
                    {newDate && <div className="journal-date">{dateLabel(entry.at)}</div>}
                    <span className="journal-time">Day {entryDay(entry)} · {entryTime(entry)}</span>
                    {entry.page ? <button type="button" className="journal-link" onClick={() => { setTab('pages'); setPage(entry.page!) }}>New page: {entry.text}</button> : <span className="journal-text">{entry.text}</span>}
                  </li>
                )
              })}
            </ol>
          )}
        </>}
        <p className="storage-note">The notebook is yours, not the jar's: it stays in this browser when you start a new world.</p>
      </div>
    </dialog>
  )
}
