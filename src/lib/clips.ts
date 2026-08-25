import type { Clip, DetectionSummary } from '../types'
import type { SilenceRange } from './silence'

let counter = 0
export function nextId(prefix = 'c'): string {
  counter += 1
  return `${prefix}${counter}-${Math.random().toString(36).slice(2, 7)}`
}

/** Menor bloco que faz sentido existir na linha do tempo. */
export const MIN_CLIP_DURATION = 0.04

export function clipDuration(clip: Clip): number {
  return Math.max(0, clip.end - clip.start)
}

export function makeClip(start: number, end: number, isSilence: boolean): Clip {
  return { id: nextId(isSilence ? 's' : 'v'), start, end, isSilence, enabled: true, kept: false, muted: false }
}

/** Um único bloco cobrindo o vídeo inteiro — estado inicial da linha do tempo. */
export function singleClip(duration: number): Clip[] {
  return [makeClip(0, Math.max(duration, MIN_CLIP_DURATION), false)]
}

/**
 * Reconstrói a linha do tempo a partir dos silêncios detectados, alternando
 * blocos de fala e de silêncio ao longo de todo o vídeo.
 */
export function clipsFromSilences(duration: number, silences: SilenceRange[]): Clip[] {
  if (silences.length === 0) return singleClip(duration)

  const clips: Clip[] = []
  let cursor = 0
  for (const silence of silences) {
    const start = Math.max(cursor, silence.start)
    const end = Math.min(duration, silence.end)
    if (end - start < MIN_CLIP_DURATION) continue
    if (start - cursor >= MIN_CLIP_DURATION) clips.push(makeClip(cursor, start, false))
    clips.push(makeClip(start, end, true))
    cursor = end
  }
  if (duration - cursor >= MIN_CLIP_DURATION) clips.push(makeClip(cursor, duration, false))
  return clips.length > 0 ? clips : singleClip(duration)
}

export function enabledClips(clips: Clip[]): Clip[] {
  return clips.filter((clip) => clip.enabled)
}

/** Duração final do vídeo, somando apenas os blocos que continuam ativos. */
export function outputDuration(clips: Clip[]): number {
  return enabledClips(clips).reduce((total, clip) => total + clipDuration(clip), 0)
}

/** Duração total do material, incluindo o que já foi removido. */
export function timelineDuration(clips: Clip[]): number {
  return clips.reduce((total, clip) => total + clipDuration(clip), 0)
}

export function removedDuration(clips: Clip[]): number {
  return clips.filter((clip) => !clip.enabled).reduce((total, clip) => total + clipDuration(clip), 0)
}

export function summarize(clips: Clip[]): DetectionSummary {
  const silences = clips.filter((clip) => clip.isSilence)
  const removable = silences.filter((clip) => !clip.kept && clip.enabled)
  const removed = silences.filter((clip) => !clip.enabled)
  const sum = (list: Clip[]) => list.reduce((total, clip) => total + clipDuration(clip), 0)
  return {
    count: silences.length,
    removableCount: removable.length,
    removedCount: removed.length,
    totalSilence: sum(silences),
    removableDuration: sum(removable),
    removedDuration: sum(removed),
  }
}

/**
 * Posição de cada bloco no eixo da linha do tempo. Blocos removidos continuam
 * ocupando espaço para que o usuário possa revisá-los e restaurá-los.
 */
export interface ClipLayout {
  clip: Clip
  index: number
  offset: number
  duration: number
}

export function layout(clips: Clip[]): ClipLayout[] {
  let offset = 0
  return clips.map((clip, index) => {
    const duration = clipDuration(clip)
    const entry = { clip, index, offset, duration }
    offset += duration
    return entry
  })
}

/** Converte uma posição da linha do tempo em (bloco, tempo no vídeo original). */
export function resolveTimelineTime(clips: Clip[], time: number): { index: number; sourceTime: number } | null {
  const entries = layout(clips)
  for (const entry of entries) {
    if (time < entry.offset + entry.duration || entry === entries[entries.length - 1]) {
      const within = Math.min(Math.max(0, time - entry.offset), entry.duration)
      return { index: entry.index, sourceTime: entry.clip.start + within }
    }
  }
  return null
}

/** Divide o bloco `index` na posição `sourceTime` do vídeo original. */
export function splitClip(clips: Clip[], index: number, sourceTime: number): Clip[] | null {
  const clip = clips[index]
  if (!clip) return null
  if (sourceTime - clip.start < MIN_CLIP_DURATION || clip.end - sourceTime < MIN_CLIP_DURATION) return null

  const left: Clip = { ...clip, id: nextId('v'), end: sourceTime }
  const right: Clip = { ...clip, id: nextId('v'), start: sourceTime }
  return [...clips.slice(0, index), left, right, ...clips.slice(index + 1)]
}

/** Move um bloco `steps` posições para a esquerda (negativo) ou direita. */
export function moveClip(clips: Clip[], index: number, steps: number): Clip[] | null {
  const target = index + steps
  if (index < 0 || index >= clips.length || target < 0 || target >= clips.length) return null
  const next = clips.slice()
  const [clip] = next.splice(index, 1)
  next.splice(target, 0, clip)
  return next
}
