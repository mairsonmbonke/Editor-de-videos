import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Clip, MediaAsset, SilenceSettings, Toast } from '../types'
import { editorReducer, initialEditorState } from '../state/editorReducer'
import { usePlayback } from '../state/usePlayback'
import { analyzeAudio, probeVideo, SAMPLES_PER_SECOND } from '../lib/audio'
import { DEFAULT_SETTINGS, detectSilences } from '../lib/silence'
import {
  clipsFromSilences,
  nextId,
  outputDuration,
  removedDuration,
  resolveTimelineTime,
  singleClip,
  splitClip,
  summarize,
  timelineDuration,
} from '../lib/clips'
import { formatDuration, formatTime, pluralize } from '../lib/format'
import { MediaSidebar } from './MediaSidebar'
import { Transport } from './Transport'
import { Timeline, MAX_ZOOM, MIN_ZOOM } from './Timeline'
import { Inspector } from './Inspector'
import { ExportDialog } from './ExportDialog'
import { Toasts } from './Toasts'
import { IconExport, IconFilm, IconLogout, IconRedo, IconUndo, IconUpload } from './icons'

interface EditorProps {
  user: string
  onLogout: () => void
}

/** Espera antes de refazer a análise enquanto o usuário arrasta os controles. */
const DETECT_DEBOUNCE = 220

export function Editor({ user, onLogout }: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const toastId = useRef(0)
  const detectTimer = useRef<number | null>(null)

  const asset = state.assets.find((item) => item.id === state.activeId) ?? null
  const project = state.activeId ? state.projects[state.activeId] : undefined
  const clips = useMemo(() => project?.present.snapshot.clips ?? [], [project])
  const settings = project?.present.snapshot.settings ?? DEFAULT_SETTINGS

  const playback = usePlayback(videoRef, clips, volume, muted)
  const summary = useMemo(() => summarize(clips), [clips])

  const silenceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [id, history] of Object.entries(state.projects)) {
      counts[id] = history.present.snapshot.clips.filter((clip) => clip.isSilence).length
    }
    return counts
  }, [state.projects])

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    toastId.current += 1
    const entry: Toast = { id: toastId.current, kind, message }
    setToasts((current) => [...current, entry])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== entry.id)), 4800)
  }, [])

  /* ── Importar vídeos ─────────────────────────────────────────────── */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((file) => file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v)$/i.test(file.name))
      if (list.length === 0) {
        toast('Selecione arquivos de vídeo (MP4, WebM ou MOV).', 'erro')
        return
      }

      const created: MediaAsset[] = []
      const initialClips: Record<string, Clip[]> = {}

      for (const file of list) {
        const url = URL.createObjectURL(file)
        try {
          const meta = await probeVideo(url)
          const id = nextId('m')
          created.push({
            id,
            name: file.name,
            file,
            url,
            duration: meta.duration,
            peaks: null,
            rms: null,
            samplesPerSecond: SAMPLES_PER_SECOND,
            analysis: 'analisando',
            width: meta.width,
            height: meta.height,
            size: file.size,
          })
          initialClips[id] = singleClip(meta.duration)
        } catch (error) {
          URL.revokeObjectURL(url)
          toast(error instanceof Error ? error.message : `Não foi possível abrir ${file.name}.`, 'erro')
        }
      }

      if (created.length === 0) return
      dispatch({ type: 'assets/add', assets: created, clips: initialClips })
      toast(`${pluralize(created.length, 'vídeo carregado', 'vídeos carregados')}. Analisando o áudio…`)

      // A análise roda uma por vez para não travar a interface com vários vídeos.
      for (const item of created) {
        try {
          const analysis = await analyzeAudio(item.file)
          const duration = item.duration || analysis.duration
          dispatch({
            type: 'assets/update',
            id: item.id,
            patch: {
              peaks: analysis.peaks,
              rms: analysis.rms,
              samplesPerSecond: analysis.samplesPerSecond,
              duration,
              analysis: 'pronto',
            },
          })
          const silences = detectSilences(analysis.rms, analysis.samplesPerSecond, duration, DEFAULT_SETTINGS)
          dispatch({
            type: 'project/reset',
            id: item.id,
            clips: clipsFromSilences(duration, silences),
            settings: DEFAULT_SETTINGS,
            label: 'Análise de silêncio',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Falha ao analisar o áudio.'
          dispatch({ type: 'assets/update', id: item.id, patch: { analysis: 'erro', analysisError: message } })
          toast(`${item.name}: ${message}`, 'erro')
        }
      }
    },
    [toast],
  )

  const removeAsset = useCallback(
    (id: string) => {
      const target = state.assets.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.url)
      dispatch({ type: 'assets/remove', id })
      setSelectedId(null)
    },
    [state.assets],
  )

  useEffect(() => {
    // Libera as URLs quando o editor é desmontado.
    const assets = state.assets
    return () => {
      for (const item of assets) URL.revokeObjectURL(item.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Reanalisar quando os ajustes mudam ──────────────────────────── */
  const changeSettings = useCallback(
    (next: SilenceSettings) => {
      dispatch({ type: 'settings/change', settings: next })
      if (!asset || asset.analysis !== 'pronto' || !asset.rms) return

      setDetecting(true)
      if (detectTimer.current) window.clearTimeout(detectTimer.current)
      const targetId = asset.id
      const rms = asset.rms
      const sps = asset.samplesPerSecond
      const duration = asset.duration
      detectTimer.current = window.setTimeout(() => {
        const silences = detectSilences(rms, sps, duration, next)
        dispatch({
          type: 'project/reset',
          id: targetId,
          clips: clipsFromSilences(duration, silences),
          settings: next,
          label: 'Ajustar detecção',
        })
        setDetecting(false)
        setSelectedId(null)
      }, DETECT_DEBOUNCE)
    },
    [asset],
  )

  useEffect(() => () => {
    if (detectTimer.current) window.clearTimeout(detectTimer.current)
  }, [])

  /* ── Ações de edição ─────────────────────────────────────────────── */
  const removeAllSilences = useCallback(() => {
    const targets = clips.filter((clip) => clip.isSilence && clip.enabled && !clip.kept)
    if (targets.length === 0) return
    const removed = targets.reduce((total, clip) => total + (clip.end - clip.start), 0)
    dispatch({
      type: 'clips/set',
      label: 'Remover todos os silêncios',
      clips: clips.map((clip) => (clip.isSilence && !clip.kept ? { ...clip, enabled: false } : clip)),
    })
    setSelectedId(null)
    toast(
      `${pluralize(targets.length, 'silêncio removido', 'silêncios removidos')} — ${formatDuration(removed)} a menos.`,
      'sucesso',
    )
  }, [clips, toast])

  const restoreAllSilences = useCallback(() => {
    if (!clips.some((clip) => clip.isSilence && !clip.enabled)) return
    dispatch({
      type: 'clips/set',
      label: 'Restaurar silêncios',
      clips: clips.map((clip) => (clip.isSilence ? { ...clip, enabled: true } : clip)),
    })
    toast('Trechos restaurados na linha do tempo.')
  }, [clips, toast])

  const toggleKeep = useCallback(
    (id: string) => {
      const clip = clips.find((item) => item.id === id)
      if (!clip) return
      dispatch({
        type: 'clips/patch',
        id,
        patch: { kept: !clip.kept, enabled: !clip.kept ? true : clip.enabled },
        label: clip.kept ? 'Voltar a cortar silêncio' : 'Ignorar silêncio',
      })
    },
    [clips],
  )

  const toggleRemoved = useCallback(
    (id: string) => {
      const clip = clips.find((item) => item.id === id)
      if (!clip) return
      dispatch({
        type: 'clips/patch',
        id,
        patch: { enabled: !clip.enabled },
        label: clip.enabled ? 'Remover trecho' : 'Restaurar trecho',
      })
    },
    [clips],
  )

  const splitAtPlayhead = useCallback(() => {
    const resolved = resolveTimelineTime(clips, playback.position)
    if (!resolved) return
    // Confere antes de despachar para não avisar sobre um corte que não aconteceu.
    if (!splitClip(clips, resolved.index, resolved.sourceTime)) {
      toast('O playhead está colado na borda do bloco — mova-o um pouco para dividir.', 'erro')
      return
    }
    dispatch({ type: 'clips/split', index: resolved.index, sourceTime: resolved.sourceTime })
    toast('Bloco dividido no playhead.')
  }, [clips, playback.position, toast])

  const deleteSelected = useCallback(() => {
    const index = selectedId
      ? clips.findIndex((clip) => clip.id === selectedId)
      : (resolveTimelineTime(clips, playback.position)?.index ?? -1)
    if (index < 0) return
    const clip = clips[index]
    if (!clip.enabled) {
      toast('Este trecho já foi removido. Use Restaurar para trazê-lo de volta.', 'erro')
      return
    }
    dispatch({ type: 'clips/delete', index })
    if (!clip.isSilence) setSelectedId(null)
    toast(clip.isSilence ? 'Trecho removido — dá para restaurar depois.' : 'Bloco excluído.')
  }, [clips, playback.position, selectedId, toast])

  const restoreSelected = useCallback(() => {
    if (!selectedId) return
    dispatch({ type: 'clips/patch', id: selectedId, patch: { enabled: true }, label: 'Restaurar trecho' })
  }, [selectedId])

  const toggleMuteSelected = useCallback(() => {
    const clip = selectedId
      ? clips.find((item) => item.id === selectedId)
      : clips[resolveTimelineTime(clips, playback.position)?.index ?? -1]
    if (!clip) return
    dispatch({
      type: 'clips/patch',
      id: clip.id,
      patch: { muted: !clip.muted },
      label: clip.muted ? 'Desmutar bloco' : 'Mutar bloco',
    })
  }, [clips, playback.position, selectedId])

  const moveSelected = useCallback(
    (steps: number) => {
      const index = clips.findIndex((clip) => clip.id === selectedId)
      if (index < 0) return
      dispatch({ type: 'clips/move', index, steps })
    },
    [clips, selectedId],
  )

  const seekToClip = useCallback(
    (id: string) => {
      let offset = 0
      for (const clip of clips) {
        if (clip.id === id) {
          setSelectedId(id)
          playback.seek(offset + 0.001)
          return
        }
        offset += clip.end - clip.start
      }
    },
    [clips, playback],
  )

  const canUndo = Boolean(project && project.past.length > 0)
  const canRedo = Boolean(project && project.future.length > 0)
  const undoLabel = project?.present.label ?? ''
  const redoLabel = project?.future[0]?.label ?? ''

  const undo = useCallback(() => {
    if (!canUndo) return
    dispatch({ type: 'history/undo' })
    setSelectedId(null)
    toast(`Desfeito: ${undoLabel.toLowerCase()}.`)
  }, [canUndo, toast, undoLabel])

  const redo = useCallback(() => {
    if (!canRedo) return
    dispatch({ type: 'history/redo' })
    setSelectedId(null)
    toast(`Refeito: ${redoLabel.toLowerCase()}.`)
  }, [canRedo, redoLabel, toast])

  /* ── Atalhos de teclado ──────────────────────────────────────────── */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (exporting) return

      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (meta) return

      switch (event.key) {
        case ' ':
          event.preventDefault()
          playback.toggle()
          break
        case 'ArrowLeft':
          event.preventDefault()
          playback.seekBy(event.shiftKey ? -1 : -5)
          break
        case 'ArrowRight':
          event.preventDefault()
          playback.seekBy(event.shiftKey ? 1 : 5)
          break
        case 'Home':
          event.preventDefault()
          playback.seekToStart()
          break
        case 'End':
          event.preventDefault()
          playback.seekToEnd()
          break
        case 's':
        case 'S':
          event.preventDefault()
          splitAtPlayhead()
          break
        case 'm':
        case 'M':
          event.preventDefault()
          toggleMuteSelected()
          break
        case 'Delete':
        case 'Backspace':
          event.preventDefault()
          deleteSelected()
          break
        case '+':
        case '=':
          event.preventDefault()
          setZoom((value) => Math.min(MAX_ZOOM, value * 1.5))
          break
        case '-':
        case '_':
          event.preventDefault()
          setZoom((value) => Math.max(MIN_ZOOM, value / 1.5))
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected, exporting, playback, redo, splitAtPlayhead, toggleMuteSelected, undo])

  // Recomeça do zero ao trocar de vídeo.
  useEffect(() => {
    setSelectedId(null)
    playback.seek(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeId])

  const currentClipId = clips[playback.clipIndex]?.id ?? null
  const total = timelineDuration(clips)
  const final = outputDuration(clips)
  const removed = removedDuration(clips)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark">
            <IconFilm size={15} />
          </span>
          <span className="topbar__name">Cortex</span>
        </div>

        <div className="topbar__file">
          {asset ? (
            <>
              <span className="topbar__file-name" title={asset.name}>
                {asset.name}
              </span>
              <span className="topbar__file-meta">
                {formatTime(total)} → {formatTime(final)}
                {removed > 0 && ` · −${formatDuration(removed)}`}
              </span>
            </>
          ) : (
            <span className="topbar__file-meta">Nenhum vídeo selecionado</span>
          )}
        </div>

        <div className="topbar__spacer" />

        <div className="topbar__group">
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={undo}
            disabled={!canUndo}
            title={canUndo ? `Desfazer: ${undoLabel} (Ctrl+Z)` : 'Nada para desfazer'}
            aria-label="Desfazer"
          >
            <IconUndo size={15} />
          </button>
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={redo}
            disabled={!canRedo}
            title={canRedo ? `Refazer: ${redoLabel} (Ctrl+Shift+Z)` : 'Nada para refazer'}
            aria-label="Refazer"
          >
            <IconRedo size={15} />
          </button>
        </div>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setExporting(true)}
          disabled={!asset || final <= 0}
          title="Exportar o vídeo final"
        >
          <IconExport size={15} /> Exportar vídeo
        </button>

        <div className="topbar__user">
          <span className="avatar" title={user}>
            {user.slice(0, 2).toUpperCase()}
          </span>
          <button type="button" className="btn btn--icon btn--ghost" onClick={onLogout} title="Sair" aria-label="Sair">
            <IconLogout size={15} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <MediaSidebar
          assets={state.assets}
          activeId={state.activeId}
          silenceCounts={silenceCounts}
          onAdd={addFiles}
          onSelect={(id) => dispatch({ type: 'assets/select', id })}
          onRemove={removeAsset}
        />

        <div className="workspace__main">
          <div className="stage-row">
            <div className="stage">
              <div className="stage__viewport">
                {asset ? (
                  <>
                    <video
                      ref={videoRef}
                      className="stage__video"
                      src={asset.url}
                      playsInline
                      preload="auto"
                      onClick={playback.toggle}
                    />
                    {clips[playback.clipIndex] && !clips[playback.clipIndex].enabled && (
                      <div className="stage__flag">Trecho removido — não entra no vídeo final</div>
                    )}
                  </>
                ) : (
                  <div className="stage__placeholder">
                    <IconUpload size={30} />
                    <h2>Comece carregando um vídeo</h2>
                    <p>
                      Adicione um ou mais arquivos pela barra lateral. O áudio é analisado automaticamente e os
                      silêncios aparecem destacados na linha do tempo.
                    </p>
                  </div>
                )}
              </div>

              <Transport
                clips={clips}
                position={playback.position}
                playing={playback.playing}
                volume={volume}
                muted={muted}
                disabled={!asset}
                onToggle={playback.toggle}
                onSeek={playback.seek}
                onSeekBy={playback.seekBy}
                onStart={playback.seekToStart}
                onEnd={playback.seekToEnd}
                onVolume={(value) => {
                  setVolume(value)
                  if (value > 0) setMuted(false)
                }}
                onToggleMute={() => setMuted((value) => !value)}
              />
            </div>

            <Inspector
              asset={asset}
              clips={clips}
              settings={settings}
              summary={summary}
              analyzing={asset?.analysis === 'analisando'}
              detecting={detecting}
              currentClipId={currentClipId}
              onSettings={changeSettings}
              onRemoveAll={removeAllSilences}
              onRestoreAll={restoreAllSilences}
              onToggleKeep={toggleKeep}
              onToggleRemoved={toggleRemoved}
              onSeekToClip={seekToClip}
            />
          </div>

          <Timeline
            asset={asset}
            clips={clips}
            position={playback.position}
            playing={playback.playing}
            selectedId={selectedId}
            zoom={zoom}
            onZoom={setZoom}
            onSeek={playback.seek}
            onSelect={setSelectedId}
            onSplit={splitAtPlayhead}
            onDelete={deleteSelected}
            onRestore={restoreSelected}
            onToggleMute={toggleMuteSelected}
            onMove={moveSelected}
          />
        </div>
      </div>

      {exporting && asset && (
        <ExportDialog
          asset={asset}
          clips={clips}
          onClose={() => setExporting(false)}
          onDone={(message) => toast(message, 'sucesso')}
          onError={(message) => toast(message, 'erro')}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  )
}
