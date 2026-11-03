import { useEffect, useMemo, useRef, useState } from 'react'
import type { World } from './sim/ecosystem'
import { metrics, projectWorld } from './sim/observatory'
import type { MetricKey, ObservationSample } from './sim/observatory'
import { parseSave } from './sim/saves'

type Props = { open: boolean; history: readonly ObservationSample[]; onClose: () => void }
type Series = { name: string; tone: 'run' | 'a' | 'b'; samples: readonly ObservationSample[] }
type View = 'run' | 'compare'

const slotKeys = ['ecosphere.experiment.a', 'ecosphere.experiment.b'] as const
const projectionDays = [3, 7, 14] as const
const percentMetrics = new Set<MetricKey>(['leafCover', 'soilWater', 'pondOxygen'])

function readSlot(key: string): World | null {
  try {
    const saved = window.localStorage.getItem(key)
    return saved ? parseSave(saved) : null
  } catch {
    return null
  }
}

const units = new Map(metrics.map((item) => [item.key, item.unit]))
const format = (value: number, key: MetricKey) => {
  const unit = units.get(key)
  if (unit === '%') return key === 'jarOxygen' ? `${value.toFixed(1)}%` : `${Math.round(value)}%`
  if (unit === 'ppm') return `${Math.round(value)} ppm`
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
const dayLabel = (tick: number) => `Day ${Math.floor(tick / 24) + 1} · ${String(tick % 24).padStart(2, '0')}:00`

function Chart({ series, metric, relative }: { series: Series[]; metric: MetricKey; relative: boolean }) {
  const width = 640, height = 250, left = 58, right = 14, top = 14, bottom = 30
  const drawn = series.filter((line) => line.samples.length > 0)
  const xs = drawn.flatMap((line) => line.samples.map((sample, index) => relative ? index : sample.tick))
  const values = drawn.flatMap((line) => line.samples.map((sample) => sample[metric]))
  if (!xs.length) return null
  const minX = Math.min(...xs), maxX = Math.max(minX + 1, ...xs)
  const maxY = percentMetrics.has(metric) ? 100 : Math.max(2, Math.ceil(Math.max(...values) * 1.1))
  const x = (value: number) => left + (value - minX) / (maxX - minX) * (width - left - right)
  const y = (value: number) => top + (1 - value / maxY) * (height - top - bottom)
  const spanDays = (maxX - minX) / 24
  const dayStep = spanDays > 30 ? 7 : spanDays > 10 ? 2 : 1
  const dayTicks: number[] = []
  for (let tick = Math.ceil(minX / 24 / dayStep) * dayStep * 24; tick <= maxX; tick += dayStep * 24) dayTicks.push(tick)
  const label = metrics.find((item) => item.key === metric)!.label
  return (
    <svg className="observatory-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} over time: ${drawn.map((line) => `${line.name} ${format(line.samples[0][metric], metric)} to ${format(line.samples[line.samples.length - 1][metric], metric)}`).join('; ')}`}>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}>
        <line className="grid" x1={left} x2={width - right} y1={y(maxY * fraction)} y2={y(maxY * fraction)} />
        <text className="axis" x={left - 7} y={y(maxY * fraction) + 4} textAnchor="end">{format(maxY * fraction, metric)}</text>
      </g>)}
      {dayTicks.map((tick) => <text key={tick} className="axis" x={x(tick)} y={height - 9} textAnchor="middle">{relative ? `+${tick / 24}d` : `D${Math.floor(tick / 24) + 1}`}</text>)}
      {drawn.map((line) => <polyline key={line.name} className={`series ${line.tone}`} points={line.samples.map((sample, index) => `${x(relative ? index : sample.tick).toFixed(1)},${y(sample[metric]).toFixed(1)}`).join(' ')} />)}
    </svg>
  )
}

export function Observatory({ open, history, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [view, setView] = useState<View>('run')
  const [metric, setMetric] = useState<MetricKey>('plants')
  const [days, setDays] = useState<(typeof projectionDays)[number]>(7)
  const [slots, setSlots] = useState<(World | null)[]>([null, null])
  const [projections, setProjections] = useState<Series[] | null>(null)

  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    setSlots(slotKeys.map(readSlot))
    dialog.current?.showModal()
  }, [open])

  useEffect(() => {
    if (!open || view !== 'compare') return
    setProjections(null)
    // Let the dialog paint "Projecting…" before the synchronous replay.
    const timer = window.setTimeout(() => {
      setProjections(slots.flatMap((world, index): Series[] => world ? [{ name: index === 0 ? 'A' : 'B', tone: index === 0 ? 'a' : 'b', samples: projectWorld(world, days * 24) }] : []))
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open, view, days, slots])

  const series: Series[] = view === 'run' ? [{ name: 'This run', tone: 'run', samples: history }] : projections ?? []
  const available = useMemo(() => new Set(metrics.filter((item) => series.some((line) => line.samples.some((sample) => sample[item.key] > 0))).map((item) => item.key)), [series])
  const chosen = metrics.find((item) => item.key === metric)!

  return (
    <dialog ref={dialog} className="experiment-dialog observatory-dialog" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }} aria-labelledby="observatory-title">
      <div className="experiment-content">
        <div className="experiment-heading"><span className="eyebrow">OBSERVATORY</span><form method="dialog"><button className="dialog-close" autoFocus type="submit" aria-label="Close observatory">×</button></form></div>
        <h2 id="observatory-title">See how your world changes.</h2>
        <div className="observatory-tabs" role="group" aria-label="Observatory view">
          <button type="button" aria-pressed={view === 'run'} className={view === 'run' ? 'active' : ''} onClick={() => setView('run')}>This run</button>
          <button type="button" aria-pressed={view === 'compare'} className={view === 'compare' ? 'active' : ''} onClick={() => setView('compare')}>Compare A & B</button>
        </div>
        {view === 'run'
          ? <p className="experiment-intro">One reading every model hour since this world began or was restored. Readings stay in this tab only.</p>
          : <p className="experiment-intro">Each kept experiment continues from its saved moment with the same rules and no tending, so you can see where each starting point leads. It does not include anything you did after saving.</p>}
        {view === 'compare' && <div className="observatory-tabs" role="group" aria-label="Projection length">
          {projectionDays.map((value) => <button key={value} type="button" aria-pressed={days === value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>{value} days</button>)}
        </div>}
        <div className="observatory-metrics" role="group" aria-label="Measurement">
          {metrics.map((item) => <button key={item.key} type="button" aria-pressed={metric === item.key} className={`${metric === item.key ? 'active' : ''} ${available.has(item.key) ? '' : 'quiet'}`} onClick={() => setMetric(item.key)}>{item.label}</button>)}
        </div>
        <figure className="observatory-figure">
          {view === 'compare' && !slots.some(Boolean) ? <p className="observatory-empty">Save a world as experiment A or B in Experiments, then compare them here.</p>
            : view === 'compare' && !projections ? <p className="observatory-empty" role="status">Projecting {days} days…</p>
            : view === 'run' && history.length < 2 ? <p className="observatory-empty">Let time run for a few hours to draw a line.</p>
            : <Chart series={series} metric={metric} relative={view === 'compare'} />}
          <figcaption className="observatory-legend">
            {series.filter((line) => line.samples.length > 0).map((line) => {
              const first = line.samples[0], last = line.samples[line.samples.length - 1]
              return <span key={line.name} className={`legend ${line.tone}`}><i aria-hidden="true" /><strong>{line.name}</strong> {chosen.label}: {format(first[metric], metric)} → {format(last[metric], metric)} <small>({dayLabel(first.tick)} to {dayLabel(last.tick)})</small></span>
            })}
          </figcaption>
        </figure>
        <p className="storage-note">Values are the game's simplified stocks and counts, not calibrated field measurements.</p>
      </div>
    </dialog>
  )
}
