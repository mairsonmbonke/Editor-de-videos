import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_SETTINGS, dbFromSensitivity, detectSilences, sensitivityFromDb } from '../src/lib/silence.ts'

const SPS = 100

/** Monta uma série de RMS a partir de trechos `[duracaoSegundos, dB]`. */
function series(parts: Array<[number, number]>): Float32Array {
  const values: number[] = []
  for (const [seconds, db] of parts) {
    for (let i = 0; i < Math.round(seconds * SPS); i += 1) values.push(db)
  }
  return Float32Array.from(values)
}

test('encontra silêncios entre trechos de fala', () => {
  const rms = series([
    [2, -12],
    [3, -80],
    [2, -12],
    [4, -80],
    [3, -12],
  ])
  const found = detectSilences(rms, SPS, 14, { thresholdDb: -38, minDuration: 0.4, padding: 0 })
  assert.equal(found.length, 2)
  assert.ok(Math.abs(found[0].start - 2) < 0.02)
  assert.ok(Math.abs(found[0].end - 5) < 0.02)
  assert.ok(Math.abs(found[1].start - 7) < 0.02)
  assert.ok(Math.abs(found[1].end - 11) < 0.02)
})

test('a margem encolhe o corte nas duas pontas', () => {
  const rms = series([
    [1, -10],
    [2, -80],
    [1, -10],
  ])
  const [cut] = detectSilences(rms, SPS, 4, { thresholdDb: -38, minDuration: 0.4, padding: 0.25 })
  assert.ok(Math.abs(cut.start - 1.25) < 0.02, `início ${cut.start}`)
  assert.ok(Math.abs(cut.end - 2.75) < 0.02, `fim ${cut.end}`)
})

test('descarta pausas mais curtas que a duração mínima', () => {
  const rms = series([
    [1, -10],
    [0.3, -80],
    [1, -10],
  ])
  assert.equal(detectSilences(rms, SPS, 2.3, { ...DEFAULT_SETTINGS, minDuration: 0.5 }).length, 0)
  assert.equal(detectSilences(rms, SPS, 2.3, { ...DEFAULT_SETTINGS, minDuration: 0.2, padding: 0 }).length, 1)
})

test('um estalo curto no meio não parte o silêncio em dois', () => {
  const rms = series([
    [1, -10],
    [1, -80],
    [0.05, -20],
    [1, -80],
    [1, -10],
  ])
  const found = detectSilences(rms, SPS, 4.05, { thresholdDb: -38, minDuration: 0.4, padding: 0 })
  assert.equal(found.length, 1)
  assert.ok(found[0].end - found[0].start > 1.9)
})

test('áudio sempre alto não gera silêncio', () => {
  assert.deepEqual(detectSilences(series([[5, -6]]), SPS, 5, DEFAULT_SETTINGS), [])
})

test('nunca ultrapassa a duração do vídeo', () => {
  const rms = series([
    [1, -10],
    [4, -80],
  ])
  const [cut] = detectSilences(rms, SPS, 5, { thresholdDb: -38, minDuration: 0.4, padding: 0 })
  assert.ok(cut.end <= 5.001, `fim ${cut.end}`)
})

test('sensibilidade e volume mínimo são conversões inversas', () => {
  for (const sensitivity of [0, 25, 58, 90, 100]) {
    assert.equal(sensitivityFromDb(dbFromSensitivity(sensitivity)), sensitivity)
  }
})

test('mais sensibilidade encontra pelo menos tantos silêncios quanto menos', () => {
  const rms = series([
    [1, -10],
    [1, -30],
    [1, -10],
  ])
  const baixa = detectSilences(rms, SPS, 3, { thresholdDb: dbFromSensitivity(10), minDuration: 0.4, padding: 0 })
  const alta = detectSilences(rms, SPS, 3, { thresholdDb: dbFromSensitivity(80), minDuration: 0.4, padding: 0 })
  assert.equal(baixa.length, 0)
  assert.equal(alta.length, 1)
})
