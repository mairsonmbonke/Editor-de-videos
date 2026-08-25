/** Um arquivo de vídeo carregado pelo usuário. */
export interface MediaAsset {
  id: string
  name: string
  file: File
  url: string
  /** Duração em segundos (do elemento de vídeo). */
  duration: number
  /** Picos de áudio normalizados (0..1), ~PEAKS_PER_SECOND por segundo. */
  peaks: Float32Array | null
  /** Amostras de RMS em dBFS usadas na detecção de silêncio. */
  rms: Float32Array | null
  /** Quantas amostras de `rms`/`peaks` correspondem a 1 segundo. */
  samplesPerSecond: number
  /** Estado da análise de áudio. */
  analysis: 'pendente' | 'analisando' | 'pronto' | 'erro'
  analysisError?: string
  width: number
  height: number
  size: number
}

/**
 * Um bloco da linha do tempo. Sempre aponta para um intervalo do vídeo de
 * origem — cortar nunca altera o arquivo original.
 */
export interface Clip {
  id: string
  /** Início no vídeo de origem, em segundos. */
  start: number
  /** Fim no vídeo de origem, em segundos. */
  end: number
  /** `true` quando o bloco foi detectado como silêncio. */
  isSilence: boolean
  /** `false` quando o bloco foi removido (permanece para poder restaurar). */
  enabled: boolean
  /** Silêncio marcado como "ignorar": nunca é removido em massa. */
  kept: boolean
  muted: boolean
}

export interface SilenceSettings {
  /** Volume mínimo (dBFS) abaixo do qual o áudio conta como silêncio. */
  thresholdDb: number
  /** Duração mínima (s) de um trecho para valer como silêncio. */
  minDuration: number
  /** Margem (s) preservada antes e depois de cada corte. */
  padding: number
}

export interface DetectionSummary {
  /** Total de trechos de silêncio detectados. */
  count: number
  /** Trechos que ainda serão cortados por "Remover todos os silêncios". */
  removableCount: number
  /** Trechos de silêncio já retirados da linha do tempo. */
  removedCount: number
  totalSilence: number
  removableDuration: number
  removedDuration: number
}

export type ToastKind = 'info' | 'sucesso' | 'erro'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}
