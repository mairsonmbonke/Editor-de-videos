/** Janelas de análise por segundo (10 ms cada). */
export const SAMPLES_PER_SECOND = 100

/** Piso em dBFS usado no lugar de -Infinito para trechos totalmente mudos. */
export const SILENCE_FLOOR_DB = -100

export interface AudioAnalysis {
  /** Pico absoluto de cada janela, normalizado em 0..1. */
  peaks: Float32Array
  /** RMS de cada janela em dBFS (-100..0). */
  rms: Float32Array
  samplesPerSecond: number
  duration: number
}

let sharedContext: AudioContext | OfflineAudioContext | null = null

function getDecodeContext(): AudioContext {
  const Ctor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new Ctor()
  }
  return sharedContext as AudioContext
}

function toDb(value: number): number {
  if (value <= 0) return SILENCE_FLOOR_DB
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(value))
}

/**
 * Decodifica a trilha de áudio de um arquivo de vídeo e reduz a duas séries:
 * picos (para a waveform) e RMS em dBFS (para a detecção de silêncio).
 */
export async function analyzeAudio(file: File): Promise<AudioAnalysis> {
  const buffer = await file.arrayBuffer()
  const ctx = getDecodeContext()

  let audio: AudioBuffer
  try {
    audio = await ctx.decodeAudioData(buffer)
  } catch {
    throw new Error(
      'Não foi possível ler o áudio deste arquivo. Verifique se o vídeo tem trilha de áudio em um formato suportado pelo navegador (MP4/AAC, WebM/Opus).',
    )
  }

  const { sampleRate, length, numberOfChannels } = audio
  if (numberOfChannels === 0 || length === 0) {
    throw new Error('Este vídeo não tem trilha de áudio, então não há silêncio a detectar.')
  }

  const channels: Float32Array[] = []
  for (let c = 0; c < numberOfChannels; c += 1) channels.push(audio.getChannelData(c))

  const windowSize = Math.max(1, Math.round(sampleRate / SAMPLES_PER_SECOND))
  const windowCount = Math.max(1, Math.ceil(length / windowSize))
  const peaks = new Float32Array(windowCount)
  const rms = new Float32Array(windowCount)

  for (let w = 0; w < windowCount; w += 1) {
    const from = w * windowSize
    const to = Math.min(length, from + windowSize)
    let peak = 0
    let sum = 0
    let count = 0
    for (let i = from; i < to; i += 1) {
      for (let c = 0; c < numberOfChannels; c += 1) {
        const sample = channels[c][i]
        const abs = sample < 0 ? -sample : sample
        if (abs > peak) peak = abs
        sum += sample * sample
        count += 1
      }
    }
    peaks[w] = peak > 1 ? 1 : peak
    rms[w] = toDb(count > 0 ? Math.sqrt(sum / count) : 0)
  }

  return { peaks, rms, samplesPerSecond: SAMPLES_PER_SECOND, duration: audio.duration }
}

/** Lê duração e dimensões do vídeo sem depender da análise de áudio. */
export function probeVideo(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }
    video.onloadedmetadata = () => {
      const result = {
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
      }
      cleanup()
      resolve(result)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Não foi possível abrir este vídeo. O formato pode não ser suportado pelo navegador.'))
    }
    video.src = url
  })
}
