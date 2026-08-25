import { useEffect, useMemo, useRef, useState } from 'react'
import type { Clip, MediaAsset } from '../types'
import { outputDuration, removedDuration, timelineDuration } from '../lib/clips'
import { formatBytes, formatDuration, formatTime } from '../lib/format'
import {
  downloadBlob,
  estimateSize,
  exportTimeline,
  isCancelled,
  pickFormat,
  type ExportProgress,
} from '../lib/export'
import { IconAlert, IconClose, IconExport, IconInfo, IconSpinner } from './icons'

interface ExportDialogProps {
  asset: MediaAsset
  clips: Clip[]
  onClose: () => void
  onDone: (message: string) => void
  onError: (message: string) => void
}

export function ExportDialog({ asset, clips, onClose, onDone, onError }: ExportDialogProps) {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [failure, setFailure] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const format = useMemo(() => pickFormat(), [])
  const original = timelineDuration(clips)
  const final = outputDuration(clips)
  const removed = removedDuration(clips)
  const width = asset.width || 1280
  const height = asset.height || 720
  const size = estimateSize(final, width, height)

  useEffect(() => () => abortRef.current?.abort(), [])

  const start = async () => {
    if (!format) {
      setFailure('Este navegador não consegue gravar vídeo. Use uma versão recente do Chrome, Edge ou Safari.')
      return
    }
    setFailure('')
    setRunning(true)
    setProgress({ ratio: 0, written: 0, total: final, clipIndex: 0, clipCount: 0 })
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await exportTimeline({
        url: asset.url,
        clips,
        width,
        height,
        format,
        signal: controller.signal,
        onProgress: setProgress,
      })
      const base = asset.name.replace(/\.[^.]+$/, '')
      downloadBlob(result.blob, `${base} - sem silencios.${result.format.extension}`)
      onDone(`Vídeo exportado (${formatBytes(result.blob.size)}). O download começou automaticamente.`)
      onClose()
    } catch (error) {
      if (isCancelled(error)) {
        onError('Exportação cancelada.')
        onClose()
        return
      }
      const message = error instanceof Error ? error.message : 'Falha inesperada ao exportar.'
      setFailure(message)
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const cancel = () => {
    if (running) {
      abortRef.current?.abort()
    } else {
      onClose()
    }
  }

  const remaining = progress ? Math.max(0, progress.total - progress.written) : final

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="dialog">
        <div className="dialog__head">
          <div>
            <h2 className="dialog__title" id="export-title">
              Exportar vídeo
            </h2>
            <p className="dialog__sub">{asset.name}</p>
          </div>
          <button type="button" className="icon-btn" onClick={cancel} aria-label="Fechar">
            <IconClose size={16} />
          </button>
        </div>

        <div className="dialog__body">
          <div className="summary-grid">
            <div className="summary-cell">
              <div className="stat__label">Duração original</div>
              <div className="stat__value">{formatTime(original)}</div>
            </div>
            <div className="summary-cell">
              <div className="stat__label">Duração final</div>
              <div className="stat__value stat__value--ok">{formatTime(final)}</div>
            </div>
            <div className="summary-cell">
              <div className="stat__label">Silêncio removido</div>
              <div className="stat__value stat__value--cut">
                {removed > 0 ? `−${formatDuration(removed)}` : '—'}
              </div>
            </div>
            <div className="summary-cell">
              <div className="stat__label">Tamanho estimado</div>
              <div className="stat__value">{formatBytes(size)}</div>
            </div>
          </div>

          {failure && (
            <div className="notice notice--error">
              <IconAlert size={14} />
              <span>{failure}</span>
            </div>
          )}

          {!format && !failure && (
            <div className="notice notice--error">
              <IconAlert size={14} />
              <span>Este navegador não consegue gravar vídeo. Use uma versão recente do Chrome, Edge ou Safari.</span>
            </div>
          )}

          {format && !format.isMp4 && (
            <div className="notice">
              <IconAlert size={14} />
              <span>
                Este navegador não grava MP4 diretamente. O arquivo sairá em <strong>WebM</strong>, que abre em
                qualquer player moderno. Para MP4, use o Chrome ou o Edge atualizados.
              </span>
            </div>
          )}

          {running && progress ? (
            <div className="field">
              <div className="progress-label">
                <span>
                  Gravando bloco {progress.clipIndex} de {progress.clipCount}
                </span>
                <span className="mono">{Math.round(progress.ratio * 100)}%</span>
              </div>
              <div className="progress">
                <div className="progress__bar" style={{ width: `${Math.max(2, progress.ratio * 100)}%` }} />
              </div>
              <p className="field__hint">Restam cerca de {formatDuration(remaining)} de vídeo para gravar.</p>
            </div>
          ) : (
            <div className="notice notice--info">
              <IconInfo size={14} />
              <span>
                A exportação roda em tempo real dentro do navegador: leva aproximadamente{' '}
                <strong>{formatDuration(final)}</strong>. Deixe esta aba aberta e em primeiro plano até terminar.
              </span>
            </div>
          )}
        </div>

        <div className="dialog__foot">
          <button type="button" className="btn btn--ghost" onClick={cancel}>
            {running ? 'Cancelar' : 'Fechar'}
          </button>
          <button type="button" className="btn btn--primary" onClick={start} disabled={running || !format || final <= 0}>
            {running ? (
              <>
                <IconSpinner size={15} className="spin" /> Exportando…
              </>
            ) : (
              <>
                <IconExport size={15} /> Exportar {format?.extension.toUpperCase() ?? 'MP4'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
