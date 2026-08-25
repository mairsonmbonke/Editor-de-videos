import type { SilenceSettings } from '../types'

export interface SilenceRange {
  start: number
  end: number
}

/** Limites do controle de sensibilidade, em dBFS. */
export const THRESHOLD_MIN_DB = -70
export const THRESHOLD_MAX_DB = -15

export const DEFAULT_SETTINGS: SilenceSettings = {
  thresholdDb: -38,
  minDuration: 0.4,
  padding: 0.08,
}

/** Sensibilidade 0..100 a partir do volume mínimo em dBFS. */
export function sensitivityFromDb(thresholdDb: number): number {
  const ratio = (thresholdDb - THRESHOLD_MIN_DB) / (THRESHOLD_MAX_DB - THRESHOLD_MIN_DB)
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100)
}

/** Volume mínimo em dBFS a partir da sensibilidade 0..100. */
export function dbFromSensitivity(sensitivity: number): number {
  const ratio = Math.min(100, Math.max(0, sensitivity)) / 100
  const db = THRESHOLD_MIN_DB + ratio * (THRESHOLD_MAX_DB - THRESHOLD_MIN_DB)
  return Math.round(db * 10) / 10
}

/** Ruídos isolados menores que isso não interrompem um trecho de silêncio. */
const BLIP_TOLERANCE = 0.12
/** Corte mais curto que isso não compensa e é descartado. */
const MIN_USEFUL_CUT = 0.06

/**
 * Encontra os trechos de silêncio a partir das amostras de RMS em dBFS.
 *
 * Um trecho precisa ficar abaixo de `thresholdDb` por pelo menos
 * `minDuration` segundos. O intervalo devolvido já vem encolhido por
 * `padding` nas duas pontas, então é exatamente o que será cortado.
 */
export function detectSilences(
  rms: Float32Array,
  samplesPerSecond: number,
  duration: number,
  settings: SilenceSettings,
): SilenceRange[] {
  if (rms.length === 0) return []

  const { thresholdDb, minDuration, padding } = settings
  const blipWindows = Math.round(BLIP_TOLERANCE * samplesPerSecond)

  // 1. Agrupa janelas abaixo do limiar, tolerando ruídos muito curtos.
  const runs: SilenceRange[] = []
  let runStart = -1
  let loudStreak = 0

  for (let i = 0; i < rms.length; i += 1) {
    const quiet = rms[i] < thresholdDb
    if (quiet) {
      if (runStart < 0) runStart = i
      loudStreak = 0
    } else if (runStart >= 0) {
      loudStreak += 1
      if (loudStreak > blipWindows) {
        runs.push({ start: runStart / samplesPerSecond, end: (i - loudStreak + 1) / samplesPerSecond })
        runStart = -1
        loudStreak = 0
      }
    }
  }
  if (runStart >= 0) {
    runs.push({ start: runStart / samplesPerSecond, end: rms.length / samplesPerSecond })
  }

  // 2. Aplica duração mínima e a margem de segurança das pontas.
  const result: SilenceRange[] = []
  for (const run of runs) {
    const end = Math.min(run.end, duration)
    const start = Math.max(0, run.start)
    if (end - start < minDuration) continue

    const cutStart = Math.max(0, start + padding)
    const cutEnd = Math.min(duration, end - padding)
    if (cutEnd - cutStart < MIN_USEFUL_CUT) continue

    const previous = result[result.length - 1]
    if (previous && cutStart - previous.end < MIN_USEFUL_CUT) {
      previous.end = cutEnd
    } else {
      result.push({ start: cutStart, end: cutEnd })
    }
  }

  return result
}
