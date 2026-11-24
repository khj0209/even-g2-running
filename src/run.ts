// Pure running-stats logic (no SDK), so it can be unit-tested with `node --test`.

export type Status = 'idle' | 'running' | 'paused'

export interface Fix {
  latitude: number
  longitude: number
  accuracy?: number // meters
  speed?: number // m/s
  timestamp?: number // ms
}

export interface Run {
  status: Status
  elapsedMs: number // time banked before the current running segment
  segmentStart: number // wall clock when the current running segment began
  distanceM: number
  speedMps: number // latest instantaneous speed
  last: { lat: number; lon: number; t: number } | null
}

const MAX_ACCURACY_M = 30 // drop fixes worse than this
const MAX_SPEED_MPS = 12 // faster than any runner = GPS jump, drop it

export const newRun = (): Run => ({ status: 'idle', elapsedMs: 0, segmentStart: 0, distanceM: 0, speedMps: 0, last: null })

export const elapsed = (r: Run, now: number) => r.elapsedMs + (r.status === 'running' ? now - r.segmentStart : 0)

/** Single tap: start / pause / resume. */
export function tap(r: Run, now: number): Run {
  if (r.status === 'running') return { ...r, status: 'paused', elapsedMs: elapsed(r, now), speedMps: 0, last: null }
  return { ...r, status: 'running', segmentStart: now, last: null } // last=null: no distance credited across a pause
}

export function addFix(r: Run, f: Fix, now: number): Run {
  if (r.status !== 'running') return r
  if (f.accuracy !== undefined && f.accuracy > MAX_ACCURACY_M) return r
  const t = f.timestamp ?? now
  const here = { lat: f.latitude, lon: f.longitude, t }
  if (!r.last) return { ...r, last: here }
  const d = haversine(r.last.lat, r.last.lon, here.lat, here.lon)
  const dt = (t - r.last.t) / 1000
  if (dt <= 0 || d / dt > MAX_SPEED_MPS) return r
  return { ...r, distanceM: r.distanceM + d, speedMps: f.speed ?? d / dt, last: here }
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}

export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Pace in min'sec" per km; dashes when standing still or no data. */
export function fmtPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0 || secPerKm >= 30 * 60) return `--'--"`
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`
}

export function render(r: Run, now: number, footer = ''): string {
  const ms = elapsed(r, now)
  const km = r.distanceM / 1000
  const label = { idle: 'TAP TO START', running: 'RUNNING', paused: 'PAUSED  tap=resume  2x=finish' }[r.status]
  return [
    `TIME  ${fmtTime(ms)}`,
    `DIST  ${km.toFixed(2)} km`,
    `PACE  ${fmtPace(r.speedMps > 0.5 ? 1000 / r.speedMps : Infinity)} /km`,
    `AVG   ${fmtPace(km > 0.05 ? ms / 1000 / km : Infinity)} /km`,
    '',
    label,
    footer,
  ].join('\n')
}
