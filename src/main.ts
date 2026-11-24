import {
  AppLocationAccuracy,
  CreateStartUpPageContainer,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { addFix, elapsed, fmtPace, fmtTime, newRun, render, tap, type Run } from './run.ts'

const KEY_CURRENT = 'g2run.current'
const KEY_HISTORY = 'g2run.history'
const TEXT = { containerID: 1, containerName: 'main' }

const bridge = await waitForEvenAppBridge()

// The host reloads the plugin in a fresh WebView when the phone backgrounds, so the
// in-progress run lives in bridge storage (browser storage does not persist there).
let run: Run = { ...newRun(), ...JSON.parse((await bridge.getLocalStorage(KEY_CURRENT)) || '{}') }
let footer = ''
let shown = ''
let busy = false
let savedAt = 0

const save = () => bridge.setLocalStorage(KEY_CURRENT, JSON.stringify(run))

await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        ...TEXT,
        xPosition: 0, yPosition: 0, width: 576, height: 288,
        borderWidth: 0, borderColor: 0, paddingLength: 8,
        content: render(run, Date.now(), footer),
        isEventCapture: 1,
      }),
    ],
  }),
)

async function draw() {
  const now = Date.now()
  const content = render(run, now, footer)
  if (busy || content === shown) return
  busy = true // serialize bridge writes; a skipped frame is redrawn next tick
  try {
    if (await bridge.textContainerUpgrade(new TextContainerUpgrade({ ...TEXT, contentOffset: 0, contentLength: 0, content }))) shown = content
    if (run.status === 'running' && now - savedAt > 10_000) {
      savedAt = now
      await save()
    }
  } finally {
    busy = false
  }
}

// A GPS failure must not kill the timer UI; show it instead.
const startGps = () =>
  bridge
    .startAppLocationUpdates({ accuracy: AppLocationAccuracy.High, intervalMs: 1000, distanceFilter: 0 })
    .catch(e => {
      footer = 'GPS unavailable'
      console.error(e)
    })

async function finish() {
  const now = Date.now()
  const entry = { date: new Date(now).toISOString(), distanceM: Math.round(run.distanceM), durationMs: elapsed(run, now) }
  const history = JSON.parse((await bridge.getLocalStorage(KEY_HISTORY)) || '[]')
  history.push(entry)
  await bridge.setLocalStorage(KEY_HISTORY, JSON.stringify(history))
  const km = entry.distanceM / 1000
  footer = `LAST ${km.toFixed(2)}km ${fmtTime(entry.durationMs)} ${fmtPace(km > 0.05 ? entry.durationMs / 1000 / km : Infinity)}/km`
  run = newRun()
  await save()
}

bridge.onAppLocationChanged(loc => {
  run = addFix(run, loc, Date.now())
})

bridge.onEvenHubEvent(async event => {
  const type = event.sysEvent?.eventType ?? (event.sysEvent ? OsEventTypeList.CLICK_EVENT : undefined)
  switch (type) {
    case OsEventTypeList.CLICK_EVENT:
      run = tap(run, Date.now())
      footer = ''
      await save()
      break
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      if (run.status === 'idle') await bridge.shutDownPageContainer(1) // system exit dialog
      else await finish()
      break
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
      shown = '' // force a redraw
      await startGps() // location updates are stopped while the WebView is suspended
      break
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:
    case OsEventTypeList.SYSTEM_EXIT_EVENT:
      await save()
      await bridge.stopAppLocationUpdates()
      break
  }
  draw()
})

await startGps()
setInterval(draw, 1000)
