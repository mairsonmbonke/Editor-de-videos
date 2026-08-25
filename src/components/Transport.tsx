import { useCallback, useRef } from 'react'
import type { Clip } from '../types'
import { layout, outputDuration, timelineDuration } from '../lib/clips'
import { formatTime } from '../lib/format'
import {
  IconBack,
  IconEnd,
  IconForward,
  IconMute,
  IconPause,
  IconPlay,
  IconStart,
  IconVolume,
} from './icons'

interface TransportProps {
  clips: Clip[]
  position: number
  playing: boolean
  volume: number
  muted: boolean
  disabled: boolean
  onToggle: () => void
  onSeek: (position: number) => void
  onSeekBy: (delta: number) => void
  onStart: () => void
  onEnd: () => void
  onVolume: (value: number) => void
  onToggleMute: () => void
}

export function Transport({
  clips,
  position,
  playing,
  volume,
  muted,
  disabled,
  onToggle,
  onSeek,
  onSeekBy,
  onStart,
  onEnd,
  onVolume,
  onToggleMute,
}: TransportProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const total = Math.max(0.001, timelineDuration(clips))
  const final = outputDuration(clips)
  const ratio = Math.min(1, Math.max(0, position / total))

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      onSeek(Math.min(total, Math.max(0, ((clientX - rect.left) / rect.width) * total)))
    },
    [onSeek, total],
  )

  return (
    <div className="transport">
      <div className="transport__buttons">
        <button type="button" className="btn btn--icon btn--ghost" onClick={onStart} disabled={disabled} title="Ir para o início (Home)" aria-label="Ir para o início">
          <IconStart size={15} />
        </button>
        <button type="button" className="btn btn--icon btn--ghost" onClick={() => onSeekBy(-5)} disabled={disabled} title="Voltar 5 segundos (←)" aria-label="Voltar 5 segundos">
          <IconBack size={15} />
        </button>
        <button
          type="button"
          className="transport__play"
          onClick={onToggle}
          disabled={disabled}
          title={playing ? 'Pausar (espaço)' : 'Reproduzir (espaço)'}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
        >
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
        <button type="button" className="btn btn--icon btn--ghost" onClick={() => onSeekBy(5)} disabled={disabled} title="Avançar 5 segundos (→)" aria-label="Avançar 5 segundos">
          <IconForward size={15} />
        </button>
        <button type="button" className="btn btn--icon btn--ghost" onClick={onEnd} disabled={disabled} title="Ir para o fim (End)" aria-label="Ir para o fim">
          <IconEnd size={15} />
        </button>
      </div>

      <div className="transport__time">
        <strong>{formatTime(position)}</strong> <span>/ {formatTime(total)}</span>
        {final < total - 0.05 && <span> · final {formatTime(final)}</span>}
      </div>

      <div
        className="seekbar"
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Posição na linha do tempo"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={formatTime(position)}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          seekFromEvent(event.clientX)
        }}
        onPointerMove={(event) => {
          if (dragging.current) seekFromEvent(event.clientX)
        }}
        onPointerUp={(event) => {
          dragging.current = false
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') onSeekBy(-5)
          if (event.key === 'ArrowRight') onSeekBy(5)
        }}
      >
        <div className="seekbar__track">
          {layout(clips)
            .filter((entry) => entry.clip.isSilence && entry.duration > 0)
            .map((entry) => (
              <span
                key={entry.clip.id}
                className="seekbar__silence"
                style={{
                  left: `${(entry.offset / total) * 100}%`,
                  width: `${Math.max(0.25, (entry.duration / total) * 100)}%`,
                  opacity: entry.clip.enabled ? 0.75 : 0.3,
                }}
              />
            ))}
          <span className="seekbar__fill" style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="seekbar__knob" style={{ left: `${ratio * 100}%` }} />
      </div>

      <div className="transport__volume">
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMute}
          title={muted ? 'Ativar som' : 'Silenciar pré-visualização'}
          aria-label={muted ? 'Ativar som' : 'Silenciar pré-visualização'}
        >
          {muted || volume === 0 ? <IconMute size={15} /> : <IconVolume size={15} />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : Math.round(volume * 100)}
          onChange={(event) => onVolume(Number(event.target.value) / 100)}
          style={{ ['--fill' as string]: `${muted ? 0 : volume * 100}%` }}
          aria-label="Volume da pré-visualização"
        />
      </div>
    </div>
  )
}
