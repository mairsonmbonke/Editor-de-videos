import { useEffect, useRef } from 'react'

interface WaveformProps {
  peaks: Float32Array | null
  samplesPerSecond: number
  start: number
  end: number
  /** Largura do bloco na tela, em pixels CSS. */
  width: number
  color: string
  dimmed?: boolean
}

/** Limite de resolução do canvas — blocos longos não precisam de mais que isso. */
const MAX_CANVAS_WIDTH = 3200

/** Desenha a waveform do trecho `start`..`end` do vídeo de origem. */
export function Waveform({ peaks, samplesPerSecond, start, end, width, color, dimmed }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cssWidth = Math.max(1, Math.min(MAX_CANVAS_WIDTH, Math.round(width)))
    const cssHeight = Math.max(1, canvas.clientHeight || 60)
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    if (!peaks || peaks.length === 0 || end <= start) return

    const from = Math.max(0, Math.floor(start * samplesPerSecond))
    const to = Math.min(peaks.length, Math.ceil(end * samplesPerSecond))
    if (to <= from) return

    const middle = cssHeight / 2
    const half = middle - 2
    const columns = Math.max(1, Math.floor(cssWidth))
    const perColumn = (to - from) / columns

    ctx.globalAlpha = dimmed ? 0.32 : 0.9
    ctx.fillStyle = color

    for (let column = 0; column < columns; column += 1) {
      const sliceStart = from + Math.floor(column * perColumn)
      const sliceEnd = Math.max(sliceStart + 1, from + Math.floor((column + 1) * perColumn))
      let peak = 0
      for (let i = sliceStart; i < sliceEnd && i < peaks.length; i += 1) {
        if (peaks[i] > peak) peak = peaks[i]
      }
      // Raiz quadrada abre visualmente os trechos baixos sem estourar os altos.
      const height = Math.max(1, Math.sqrt(peak) * half)
      ctx.fillRect(column, middle - height, 1, height * 2)
    }

    ctx.globalAlpha = 1
  }, [peaks, samplesPerSecond, start, end, width, color, dimmed])

  return <canvas ref={canvasRef} className="clip__wave" style={{ width: '100%', height: '100%' }} />
}
