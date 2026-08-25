import { useCallback, useEffect, useRef, useState } from 'react'
import type { Clip } from '../types'
import { layout, resolveTimelineTime } from '../lib/clips'

/** Margem para considerar que um bloco chegou ao fim. */
const EDGE = 0.02

export interface PlaybackController {
  playing: boolean
  /** Posição na linha do tempo, contando também os blocos removidos. */
  position: number
  /** Índice do bloco sob o cursor. */
  clipIndex: number
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (position: number) => void
  seekBy: (delta: number) => void
  seekToStart: () => void
  seekToEnd: () => void
  jumpClip: (step: number) => void
}

export function usePlayback(
  videoRef: React.RefObject<HTMLVideoElement>,
  clips: Clip[],
  volume: number,
  globalMuted: boolean,
): PlaybackController {
  const [playing, setPlaying] = useState(false)
  const [position, setPositionState] = useState(0)
  const [clipIndex, setClipIndex] = useState(0)

  const clipsRef = useRef(clips)
  clipsRef.current = clips
  const indexRef = useRef(0)
  const positionRef = useRef(0)
  const playingRef = useRef(false)
  const frameRef = useRef(0)

  const setPosition = useCallback((value: number) => {
    positionRef.current = value
    setPositionState(value)
  }, [])

  const setIndex = useCallback((value: number) => {
    indexRef.current = value
    setClipIndex(value)
  }, [])

  const applyAudio = useCallback(
    (index: number) => {
      const video = videoRef.current
      const clip = clipsRef.current[index]
      if (!video) return
      video.volume = Math.min(1, Math.max(0, volume))
      video.muted = globalMuted || Boolean(clip?.muted)
    },
    [globalMuted, videoRef, volume],
  )

  useEffect(() => {
    applyAudio(indexRef.current)
  }, [applyAudio, clipIndex, clips])

  const nextEnabled = useCallback((from: number) => {
    const list = clipsRef.current
    for (let i = Math.max(0, from); i < list.length; i += 1) {
      if (list[i].enabled) return i
    }
    return -1
  }, [])

  const positionOf = useCallback((index: number, sourceTime: number) => {
    const entries = layout(clipsRef.current)
    const entry = entries[index]
    if (!entry) return 0
    return entry.offset + Math.min(Math.max(0, sourceTime - entry.clip.start), entry.duration)
  }, [])

  const stop = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    videoRef.current?.pause()
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [videoRef])

  const tick = useCallback(() => {
    const video = videoRef.current
    if (!video || !playingRef.current) return

    const clip = clipsRef.current[indexRef.current]
    if (!clip) {
      stop()
      return
    }

    if (video.currentTime >= clip.end - EDGE || video.ended) {
      const next = nextEnabled(indexRef.current + 1)
      if (next < 0) {
        setPosition(positionOf(indexRef.current, clip.end))
        stop()
        return
      }
      setIndex(next)
      video.currentTime = clipsRef.current[next].start
      applyAudio(next)
    } else {
      setPosition(positionOf(indexRef.current, video.currentTime))
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [applyAudio, nextEnabled, positionOf, setIndex, setPosition, stop, videoRef])

  const play = useCallback(() => {
    const video = videoRef.current
    if (!video || clipsRef.current.length === 0) return

    let index = indexRef.current
    // Não faz sentido tocar dentro de um bloco removido: pula para o próximo ativo.
    if (!clipsRef.current[index]?.enabled) {
      const next = nextEnabled(index + 1) >= 0 ? nextEnabled(index + 1) : nextEnabled(0)
      if (next < 0) return
      index = next
      setIndex(next)
      video.currentTime = clipsRef.current[next].start
    }

    const clip = clipsRef.current[index]
    if (video.currentTime < clip.start || video.currentTime >= clip.end - EDGE) {
      video.currentTime = clip.start
    }

    applyAudio(index)
    playingRef.current = true
    setPlaying(true)
    void video.play().catch(() => stop())
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(tick)
  }, [applyAudio, nextEnabled, setIndex, stop, tick, videoRef])

  const seek = useCallback(
    (target: number) => {
      const video = videoRef.current
      const resolved = resolveTimelineTime(clipsRef.current, Math.max(0, target))
      if (!video || !resolved) return
      setIndex(resolved.index)
      video.currentTime = resolved.sourceTime
      applyAudio(resolved.index)
      setPosition(positionOf(resolved.index, resolved.sourceTime))
    },
    [applyAudio, positionOf, setIndex, setPosition, videoRef],
  )

  const pause = useCallback(() => stop(), [stop])
  const toggle = useCallback(() => (playingRef.current ? stop() : play()), [play, stop])
  const seekBy = useCallback((delta: number) => seek(position + delta), [position, seek])
  const seekToStart = useCallback(() => seek(0), [seek])

  const seekToEnd = useCallback(() => {
    const entries = layout(clipsRef.current)
    const last = [...entries].reverse().find((entry) => entry.clip.enabled)
    if (last) seek(last.offset + Math.max(0, last.duration - 0.05))
  }, [seek])

  const jumpClip = useCallback(
    (step: number) => {
      const entries = layout(clipsRef.current)
      const target = Math.min(entries.length - 1, Math.max(0, indexRef.current + step))
      const entry = entries[target]
      if (entry) seek(entry.offset + 0.001)
    },
    [seek],
  )

  /**
   * Cortes, divisões e reordenações mudam o significado dos índices. Depois de
   * qualquer alteração, redescobre em qual bloco o playhead está.
   */
  useEffect(() => {
    const resolved = resolveTimelineTime(clips, positionRef.current)
    if (resolved && resolved.index !== indexRef.current) setIndex(resolved.index)
  }, [clips, setIndex])

  // Encerra a reprodução quando o editor é desmontado.
  useEffect(() => stop, [stop])

  return {
    playing,
    position,
    clipIndex,
    play,
    pause,
    toggle,
    seek,
    seekBy,
    seekToStart,
    seekToEnd,
    jumpClip,
  }
}
