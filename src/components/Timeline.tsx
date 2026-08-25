import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Clip, MediaAsset } from '../types'
import { clipDuration, layout, timelineDuration } from '../lib/clips'
import { formatTime, formatTimePrecise } from '../lib/format'
import { Waveform } from './Waveform'
import {
  IconArrowLeft,
  IconArrowRight,
  IconMute,
  IconRestore,
  IconSplit,
  IconTrash,
  IconVolume,
  IconZoomIn,
  IconZoomOut,
} from './icons'

interface TimelineProps {
  asset: MediaAsset | null
  clips: Clip[]
  position: number
  playing: boolean
  selectedId: string | null
  onSeek: (position: number) => void
  onSelect: (id: string | null) => void
  onSplit: () => void
  onDelete: () => void
  onRestore: () => void
  onToggleMute: () => void
  onMove: (steps: number) => void
  zoom: number
  onZoom: (zoom: number) => void
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 60
/** Espaçamento alvo entre marcas da régua, em pixels. */
const TICK_TARGET_PX = 92
const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

function pickTickStep(pxPerSecond: number): number {
  for (const step of TICK_STEPS) {
    if (step * pxPerSecond >= TICK_TARGET_PX) return step
  }
  return TICK_STEPS[TICK_STEPS.length - 1]
}

export function Timeline({
  asset,
  clips,
  position,
  playing,
  selectedId,
  onSeek,
  onSelect,
  onSplit,
  onDelete,
  onRestore,
  onToggleMute,
  onMove,
  zoom,
  onZoom,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState(900)
  const [height, setHeight] = useState(250)
  const draggingRef = useRef(false)

  const total = Math.max(0.001, timelineDuration(clips))
  const entries = layout(clips)
  const basePxPerSecond = viewportWidth / total
  const pxPerSecond = basePxPerSecond * zoom
  const contentWidth = total * pxPerSecond
  const selected = clips.find((clip) => clip.id === selectedId) ?? null
  const selectedIndex = clips.findIndex((clip) => clip.id === selectedId)

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth || 900))
    observer.observe(element)
    setViewportWidth(element.clientWidth || 900)
    return () => observer.disconnect()
  }, [])

  // Mantém o playhead visível enquanto o vídeo toca.
  useEffect(() => {
    const element = scrollRef.current
    if (!element || !playing) return
    const x = position * pxPerSecond
    const margin = element.clientWidth * 0.15
    if (x < element.scrollLeft + margin || x > element.scrollLeft + element.clientWidth - margin) {
      element.scrollLeft = Math.max(0, x - element.clientWidth / 2)
    }
  }, [playing, position, pxPerSecond])

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const element = scrollRef.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const x = clientX - rect.left + element.scrollLeft
      onSeek(Math.min(total, Math.max(0, x / pxPerSecond)))
    },
    [onSeek, pxPerSecond, total],
  )

  const startScrub = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    seekFromEvent(event.clientX)
  }

  const continueScrub = (event: React.PointerEvent) => {
    if (draggingRef.current) seekFromEvent(event.clientX)
  }

  const endScrub = (event: React.PointerEvent) => {
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const element = scrollRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const anchorTime = (event.clientX - rect.left + element.scrollLeft) / pxPerSecond
    const factor = event.deltaY < 0 ? 1.22 : 1 / 1.22
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
    onZoom(next)
    requestAnimationFrame(() => {
      const nextPx = basePxPerSecond * next
      element.scrollLeft = Math.max(0, anchorTime * nextPx - (event.clientX - rect.left))
    })
  }

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = height
    const move = (moveEvent: PointerEvent) => {
      setHeight(Math.min(560, Math.max(168, startHeight - (moveEvent.clientY - startY))))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const ticks: React.ReactNode[] = []
  if (asset) {
    const step = pickTickStep(pxPerSecond)
    const minor = step / 2
    for (let time = 0; time <= total + 0.001; time += minor) {
      const isMajor = Math.abs(time / step - Math.round(time / step)) < 0.001
      ticks.push(
        <div
          key={time.toFixed(3)}
          className={`ruler__tick${isMajor ? '' : ' ruler__tick--minor'}`}
          style={{ left: `${time * pxPerSecond}px` }}
        >
          {isMajor ? (step < 1 ? formatTimePrecise(time) : formatTime(time)) : ''}
        </div>,
      )
    }
  }

  return (
    <section className="timeline" style={{ ['--timeline-h' as string]: `${height}px` }} aria-label="Linha do tempo">
      <div
        className="timeline__resizer"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Redimensionar linha do tempo"
      />

      <div className="timeline__bar">
        <div className="timeline__tools">
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onSplit}
            disabled={!asset}
            title="Dividir o bloco na posição do playhead (S)"
          >
            <IconSplit size={14} /> Dividir
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onDelete}
            disabled={!selected || !selected.enabled}
            title="Excluir o bloco selecionado (Delete)"
          >
            <IconTrash size={14} /> Excluir
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onRestore}
            disabled={!selected || selected.enabled}
            title="Restaurar o bloco removido"
          >
            <IconRestore size={14} /> Restaurar
          </button>
          <button
            type="button"
            className={`btn btn--sm btn--ghost${selected?.muted ? ' is-on' : ''}`}
            onClick={onToggleMute}
            disabled={!selected}
            title="Mutar ou desmutar o bloco selecionado (M)"
          >
            {selected?.muted ? <IconMute size={14} /> : <IconVolume size={14} />} Mutar
          </button>

          <span className="toolbar-sep" />

          <button
            type="button"
            className="btn btn--sm btn--icon btn--ghost"
            onClick={() => onMove(-1)}
            disabled={!selected || selectedIndex <= 0}
            title="Mover bloco para a esquerda"
            aria-label="Mover bloco para a esquerda"
          >
            <IconArrowLeft size={14} />
          </button>
          <button
            type="button"
            className="btn btn--sm btn--icon btn--ghost"
            onClick={() => onMove(1)}
            disabled={!selected || selectedIndex < 0 || selectedIndex >= clips.length - 1}
            title="Mover bloco para a direita"
            aria-label="Mover bloco para a direita"
          >
            <IconArrowRight size={14} />
          </button>
        </div>

        <div className="topbar__spacer" />

        <div className="zoom">
          <button
            type="button"
            className="btn btn--sm btn--icon btn--ghost"
            onClick={() => onZoom(Math.max(MIN_ZOOM, zoom / 1.5))}
            disabled={zoom <= MIN_ZOOM}
            title="Reduzir zoom (-)"
            aria-label="Reduzir zoom"
          >
            <IconZoomOut size={14} />
          </button>
          <span className="zoom__value mono">{zoom.toFixed(1)}×</span>
          <button
            type="button"
            className="btn btn--sm btn--icon btn--ghost"
            onClick={() => onZoom(Math.min(MAX_ZOOM, zoom * 1.5))}
            disabled={zoom >= MAX_ZOOM}
            title="Aumentar zoom (+)"
            aria-label="Aumentar zoom"
          >
            <IconZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="timeline__scroll" ref={scrollRef} onWheel={handleWheel}>
        {!asset ? (
          <div className="timeline__hint">Carregue um vídeo para ver a linha do tempo.</div>
        ) : (
          <div className="timeline__inner" style={{ width: `${Math.max(contentWidth, viewportWidth)}px` }}>
            <div
              className="ruler"
              onPointerDown={startScrub}
              onPointerMove={continueScrub}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
            >
              {ticks}
            </div>

            <div
              className="track"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget || (event.target as HTMLElement).closest('.track__clips') === event.target) {
                  onSelect(null)
                }
                startScrub(event)
              }}
              onPointerMove={continueScrub}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
            >
              <div className="track__clips">
                {entries.map(({ clip, duration, offset }) => {
                  const width = duration * pxPerSecond
                  const classes = ['clip']
                  if (clip.isSilence) classes.push(clip.kept ? 'clip--kept' : 'clip--silence')
                  if (!clip.enabled) classes.push('clip--removed')
                  if (clip.muted) classes.push('clip--muted')
                  if (clip.id === selectedId) classes.push('is-selected')

                  return (
                    <div
                      key={clip.id}
                      className={classes.join(' ')}
                      style={{ left: `${offset * pxPerSecond}px`, width: `${Math.max(2, width)}px` }}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        onSelect(clip.id)
                        startScrub(event)
                      }}
                      onPointerMove={continueScrub}
                      onPointerUp={endScrub}
                      onPointerCancel={endScrub}
                      title={`${formatTimePrecise(clip.start)} → ${formatTimePrecise(clip.end)} · ${clipDuration(clip).toFixed(2)}s`}
                    >
                      <Waveform
                        peaks={asset.peaks}
                        samplesPerSecond={asset.samplesPerSecond}
                        start={clip.start}
                        end={clip.end}
                        width={width}
                        color={clip.isSilence ? '#ffcda4' : '#bff0dd'}
                        dimmed={!clip.enabled}
                      />
                      {width > 54 && (
                        <span className="clip__label">
                          {clip.isSilence ? (clip.enabled ? (clip.kept ? 'Mantido' : 'Silêncio') : 'Removido') : 'Vídeo'}
                        </span>
                      )}
                      {clip.muted && width > 26 && (
                        <span className="clip__badge">
                          <IconMute size={11} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="playhead" style={{ left: `${position * pxPerSecond}px` }}>
                <span className="playhead__grip" />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
