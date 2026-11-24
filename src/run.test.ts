import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addFix, elapsed, fmtPace, fmtTime, haversine, newRun, render, tap } from './run.ts'

// ~0.001 deg latitude ≈ 111 m
const fix = (lat: number, t: number, extra = {}) => ({ latitude: lat, longitude: 127, timestamp: t, ...extra })

test('haversine ~111 m per 0.001 deg lat', () => {
  assert.ok(Math.abs(haversine(37, 127, 37.001, 127) - 111.2) < 0.5)
})

test('distance only accrues while running, and not across a pause', () => {
  let r = newRun()
  r = addFix(r, fix(37, 0), 0)
  assert.equal(r.distanceM, 0) // idle ignored
  r = tap(r, 0)
  r = addFix(r, fix(37, 0), 0)
  r = addFix(r, fix(37.001, 30_000), 30_000)
  assert.ok(Math.abs(r.distanceM - 111.2) < 0.5)
  r = tap(r, 30_000) // pause
  r = addFix(r, fix(37.01, 60_000), 60_000)
  r = tap(r, 90_000) // resume: first fix only anchors
  r = addFix(r, fix(37.02, 90_000), 90_000)
  assert.ok(Math.abs(r.distanceM - 111.2) < 0.5)
  assert.equal(elapsed(r, 100_000), 30_000 + 10_000)
})

test('drops inaccurate fixes and GPS jumps', () => {
  let r = tap(newRun(), 0)
  r = addFix(r, fix(37, 0), 0)
  r = addFix(r, fix(37.001, 1000, { accuracy: 80 }), 1000) // bad accuracy
  r = addFix(r, fix(37.01, 2000), 2000) // 1.1 km in 2 s
  assert.equal(r.distanceM, 0)
})

test('formatting', () => {
  assert.equal(fmtTime(65_000), '01:05')
  assert.equal(fmtTime(3_725_000), '1:02:05')
  assert.equal(fmtPace(312), `5'12"`)
  assert.equal(fmtPace(Infinity), `--'--"`)
  assert.match(render(newRun(), 0), /TAP TO START/)
})
