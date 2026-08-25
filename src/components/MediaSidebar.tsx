import { useRef, useState } from 'react'
import type { MediaAsset } from '../types'
import { formatBytes, formatTime, pluralize } from '../lib/format'
import { IconClose, IconFilm, IconSpinner, IconUpload } from './icons'

interface MediaSidebarProps {
  assets: MediaAsset[]
  activeId: string | null
  silenceCounts: Record<string, number>
  onAdd: (files: FileList | File[]) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export function MediaSidebar({ assets, activeId, silenceCounts, onAdd, onSelect, onRemove }: MediaSidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 0) onAdd(event.dataTransfer.files)
  }

  return (
    <aside className="sidebar">
      <div className="panel-title">
        <span>Mídia</span>
        <span>{assets.length > 0 ? pluralize(assets.length, 'vídeo', 'vídeos') : ''}</span>
      </div>

      <div className="sidebar__actions">
        <button
          type="button"
          className={`dropzone${dragging ? ' is-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <IconUpload size={19} />
          <span className="dropzone__title">Adicionar vídeos</span>
          <span className="dropzone__hint">Clique ou arraste — MP4, WebM, MOV</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="visually-hidden"
          onChange={(event) => {
            if (event.target.files?.length) onAdd(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {assets.length === 0 ? (
        <p className="empty-note">Nenhum vídeo carregado ainda.</p>
      ) : (
        <ul className="media-list">
          {assets.map((asset) => {
            const count = silenceCounts[asset.id] ?? 0
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  className={`media-item${asset.id === activeId ? ' is-active' : ''}`}
                  onClick={() => onSelect(asset.id)}
                  aria-current={asset.id === activeId}
                >
                  <span className="media-item__thumb">
                    {asset.url ? (
                      <video src={`${asset.url}#t=0.6`} muted preload="metadata" playsInline />
                    ) : (
                      <IconFilm size={16} />
                    )}
                  </span>
                  <span className="media-item__body">
                    <span className="media-item__name" title={asset.name}>
                      {asset.name}
                    </span>
                    <span className="media-item__meta">
                      <span className="mono">{formatTime(asset.duration)}</span>
                      <span>·</span>
                      <span>{formatBytes(asset.size)}</span>
                    </span>
                    <span className="media-item__meta">
                      {asset.analysis === 'analisando' && (
                        <span className="badge badge--busy">
                          <IconSpinner size={9} className="spin" /> analisando
                        </span>
                      )}
                      {asset.analysis === 'erro' && <span className="badge badge--error">sem áudio</span>}
                      {asset.analysis === 'pronto' &&
                        (count > 0 ? (
                          <span className="badge badge--silence">{pluralize(count, 'silêncio', 'silêncios')}</span>
                        ) : (
                          <span className="badge badge--ok">sem silêncios</span>
                        ))}
                    </span>
                  </span>
                </button>
                <span
                  className="media-item__remove"
                  role="button"
                  tabIndex={0}
                  title="Remover da lista"
                  aria-label={`Remover ${asset.name} da lista`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(asset.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      onRemove(asset.id)
                    }
                  }}
                >
                  <IconClose size={12} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
