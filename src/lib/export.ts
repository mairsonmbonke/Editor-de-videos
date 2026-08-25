import type { Clip } from '../types'
import { clipDuration, enabledClips } from './clips'

/** Formatos tentados em ordem: MP4 primeiro, WebM só como último recurso. */
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export interface ExportFormat {
  mimeType: string
  extension: 'mp4' | 'webm'
  isMp4: boolean
}

export function pickFormat(): ExportFormat | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const mimeType of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      const isMp4 = mimeType.startsWith('video/mp4')
      return { mimeType, extension: isMp4 ? 'mp4' : 'webm', isMp4 }
    }
  }
  return null
}

export const EXPORT_FPS = 30
export const AUDIO_BITRATE = 128_000

/** Bitrate de vídeo estimado a partir da resolução (0,1 bit por pixel por quadro). */
export function videoBitrateFor(width: number, height: number): number {
  const pixels = Math.max(1, width * height)
  const raw = pixels * EXPORT_FPS * 0.1
  return Math.round(Math.min(12_000_000, Math.max(1_500_000, raw)))
}

/** Tamanho estimado do arquivo final, em bytes. */
export function estimateSize(durationSeconds: number, width: number, height: number): number {
  const bits = (videoBitrateFor(width, height) + AUDIO_BITRATE) * durationSeconds
  return Math.round(bits / 8)
}

export interface ExportProgress {
  /** Fração concluída, de 0 a 1. */
  ratio: number
  /** Segundos do vídeo final já gravados. */
  written: number
  total: number
  clipIndex: number
  clipCount: number
}

export interface ExportOptions {
  url: string
  clips: Clip[]
  width: number
  height: number
  format: ExportFormat
  onProgress?: (progress: ExportProgress) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  format: ExportFormat
  duration: number
}

class Cancelled extends Error {
  constructor() {
    super('Exportação cancelada')
    this.name = 'Cancelled'
  }
}

export function isCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'Cancelled'
}

function waitFor(target: EventTarget, event: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      target.removeEventListener(event, done)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      target.removeEventListener(event, done)
      reject(new Error(`O navegador não respondeu ao evento "${event}" a tempo.`))
    }, timeoutMs)
    target.addEventListener(event, done, { once: true })
  })
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.005 && video.readyState >= 2) return
  const seeked = waitFor(video, 'seeked')
  video.currentTime = time
  await seeked
}

/**
 * Gera o vídeo final gravando a reprodução bloco a bloco. Entre um bloco e
 * outro a gravação é pausada, então os trechos removidos não deixam buraco
 * nem congelam a imagem no arquivo exportado.
 */
export async function exportTimeline(options: ExportOptions): Promise<ExportResult> {
  const { url, clips, width, height, format, onProgress, signal } = options
  const usable = enabledClips(clips).filter((clip) => clipDuration(clip) > 0.01)
  if (usable.length === 0) throw new Error('Não há nada para exportar: todos os blocos foram removidos.')

  const total = usable.reduce((sum, clip) => sum + clipDuration(clip), 0)
  const throwIfCancelled = () => {
    if (signal?.aborted) throw new Cancelled()
  }

  const video = document.createElement('video')
  video.src = url
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  video.playsInline = true
  video.muted = false
  // Mantido fora da tela: a imagem vai para o canvas e o som para o WebAudio.
  video.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(video)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, width - (width % 2))
  canvas.height = Math.max(2, height - (height % 2))
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Não foi possível preparar o canvas de exportação.')

  const AudioCtor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioContext = new AudioCtor()
  const gain = audioContext.createGain()
  const destination = audioContext.createMediaStreamDestination()
  let source: MediaElementAudioSourceNode | null = null
  let recorder: MediaRecorder | null = null
  let frameHandle = 0

  const cleanup = () => {
    if (frameHandle) cancelAnimationFrame(frameHandle)
    try {
      recorder?.state !== 'inactive' && recorder?.stop()
    } catch {
      /* já parado */
    }
    try {
      source?.disconnect()
      gain.disconnect()
    } catch {
      /* nada a desconectar */
    }
    void audioContext.close().catch(() => undefined)
    video.pause()
    video.removeAttribute('src')
    video.load()
    video.remove()
  }

  try {
    await waitFor(video, 'loadeddata')
    throwIfCancelled()

    source = audioContext.createMediaElementSource(video)
    source.connect(gain)
    gain.connect(destination)
    // O gráfico não é ligado a audioContext.destination, então a exportação
    // acontece em silêncio para quem está usando o app.
    await audioContext.resume().catch(() => undefined)

    // Laço simples de redesenho: o canvas é amostrado pelo gravador a 30 fps.
    const draw = () => {
      if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      frameHandle = requestAnimationFrame(draw)
    }
    draw()

    const canvasStream = canvas.captureStream(EXPORT_FPS)

    const stream = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()])

    const chunks: Blob[] = []
    recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: videoBitrateFor(canvas.width, canvas.height),
      audioBitsPerSecond: AUDIO_BITRATE,
    })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const stopped = new Promise<void>((resolve, reject) => {
      recorder!.onstop = () => resolve()
      recorder!.onerror = () => reject(new Error('A gravação do vídeo falhou no navegador.'))
    })

    // Primeiro quadro pronto antes de abrir a gravação.
    await seekTo(video, usable[0].start)
    throwIfCancelled()
    recorder.start(500)
    recorder.pause()

    let written = 0
    for (let index = 0; index < usable.length; index += 1) {
      const clip = usable[index]
      throwIfCancelled()

      await seekTo(video, clip.start)
      gain.gain.value = clip.muted ? 0 : 1
      recorder.resume()
      await video.play()

      await new Promise<void>((resolve, reject) => {
        const tick = () => {
          if (signal?.aborted) {
            video.pause()
            reject(new Cancelled())
            return
          }
          const position = Math.min(video.currentTime, clip.end)
          const done = video.currentTime >= clip.end - 0.01 || video.ended
          onProgress?.({
            ratio: total > 0 ? Math.min(1, (written + Math.max(0, position - clip.start)) / total) : 0,
            written: written + Math.max(0, position - clip.start),
            total,
            clipIndex: index + 1,
            clipCount: usable.length,
          })
          if (done) {
            video.pause()
            resolve()
            return
          }
          requestAnimationFrame(tick)
        }
        tick()
      })

      recorder.pause()
      written += clipDuration(clip)
    }

    recorder.requestData()
    recorder.stop()
    await stopped

    const blob = new Blob(chunks, { type: format.mimeType })
    if (blob.size === 0) throw new Error('A exportação terminou sem dados. Tente novamente com outro navegador.')
    return { blob, format, duration: total }
  } finally {
    cleanup()
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
