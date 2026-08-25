import type { Clip, DetectionSummary, MediaAsset, SilenceSettings } from '../types'
import { clipDuration, layout } from '../lib/clips'
import { formatDuration, formatTime, pluralize } from '../lib/format'
import { THRESHOLD_MAX_DB, THRESHOLD_MIN_DB, dbFromSensitivity, sensitivityFromDb } from '../lib/silence'
import {
  IconAlert,
  IconEye,
  IconEyeOff,
  IconRestore,
  IconScissors,
  IconSpinner,
  IconTrash,
  IconWand,
} from './icons'

interface Preset {
  id: string
  label: string
  settings: SilenceSettings
}

const PRESETS: Preset[] = [
  { id: 'suave', label: 'Conservador', settings: { thresholdDb: -48, minDuration: 0.7, padding: 0.15 } },
  { id: 'padrao', label: 'Equilibrado', settings: { thresholdDb: -38, minDuration: 0.4, padding: 0.08 } },
  { id: 'forte', label: 'Agressivo', settings: { thresholdDb: -30, minDuration: 0.22, padding: 0.04 } },
]

function matchesPreset(preset: Preset, settings: SilenceSettings): boolean {
  return (
    Math.abs(preset.settings.thresholdDb - settings.thresholdDb) < 0.05 &&
    Math.abs(preset.settings.minDuration - settings.minDuration) < 0.005 &&
    Math.abs(preset.settings.padding - settings.padding) < 0.005
  )
}

interface InspectorProps {
  asset: MediaAsset | null
  clips: Clip[]
  settings: SilenceSettings
  summary: DetectionSummary
  analyzing: boolean
  detecting: boolean
  currentClipId: string | null
  onSettings: (settings: SilenceSettings) => void
  onRemoveAll: () => void
  onRestoreAll: () => void
  onToggleKeep: (id: string) => void
  onToggleRemoved: (id: string) => void
  onSeekToClip: (id: string) => void
}

export function Inspector({
  asset,
  clips,
  settings,
  summary,
  analyzing,
  detecting,
  currentClipId,
  onSettings,
  onRemoveAll,
  onRestoreAll,
  onToggleKeep,
  onToggleRemoved,
  onSeekToClip,
}: InspectorProps) {
  const sensitivity = sensitivityFromDb(settings.thresholdDb)
  const silences = layout(clips).filter((entry) => entry.clip.isSilence)
  const keptCount = clips.filter((clip) => clip.isSilence && clip.kept).length
  const ready = asset?.analysis === 'pronto'
  const busy = analyzing || detecting

  // A manchete acompanha o estado: o que dá para cortar, ou o que já foi cortado.
  const headline =
    summary.removableCount > 0
      ? `${pluralize(summary.count, 'silêncio encontrado', 'silêncios encontrados')} — ${formatDuration(summary.removableDuration)} podem ser removidos.`
      : summary.removedCount > 0
        ? `${pluralize(summary.removedCount, 'silêncio removido', 'silêncios removidos')} — ${formatDuration(summary.removedDuration)} a menos no vídeo final.`
        : `${pluralize(summary.count, 'silêncio encontrado', 'silêncios encontrados')} — todos marcados para manter.`

  const subline =
    summary.removableCount > 0
      ? summary.removedCount > 0
        ? `${pluralize(summary.removedCount, 'trecho já removido', 'trechos já removidos')} — ainda dá para cortar mais.`
        : 'Revise os trechos abaixo antes de cortar.'
      : summary.removedCount > 0
        ? 'Dá para restaurar qualquer trecho a qualquer momento.'
        : `${pluralize(keptCount, 'trecho marcado', 'trechos marcados')} para ignorar nos cortes.`

  const update = (patch: Partial<SilenceSettings>) => onSettings({ ...settings, ...patch })

  return (
    <aside className="inspector">
      <div className="panel-title">
        <span>Detecção de silêncio</span>
        {busy && <IconSpinner size={13} className="spin" />}
      </div>

      <div className="inspector__scroll">
        <div className="section">
          {!asset ? (
            <div className="result-card result-card--idle">
              <p className="result-card__headline">Carregue um vídeo para começar a análise.</p>
            </div>
          ) : asset.analysis === 'erro' ? (
            <div className="notice notice--error">
              <IconAlert size={14} />
              <span>{asset.analysisError ?? 'Não foi possível analisar o áudio deste vídeo.'}</span>
            </div>
          ) : analyzing ? (
            <div className="result-card result-card--idle">
              <p className="result-card__headline">
                <IconSpinner size={13} className="spin" /> Analisando o áudio…
              </p>
              <p className="result-card__sub">Isso leva alguns segundos na primeira vez que o vídeo é aberto.</p>
            </div>
          ) : summary.count === 0 ? (
            <div className="result-card result-card--idle">
              <p className="result-card__headline">Nenhum silêncio encontrado com os ajustes atuais.</p>
              <p className="result-card__sub">
                Aumente a sensibilidade ou reduza a duração mínima para encontrar mais trechos.
              </p>
            </div>
          ) : (
            <div className="result-card">
              <p className="result-card__headline">{headline}</p>
              <p className="result-card__sub">{subline}</p>
              <div className="result-card__stats">
                <div className="stat">
                  <div className="stat__label">Silêncio total</div>
                  <div className="stat__value stat__value--cut">{formatTime(summary.totalSilence)}</div>
                </div>
                <div className="stat">
                  <div className="stat__label">{summary.removedCount > 0 ? 'Já removido' : 'A remover'}</div>
                  <div className="stat__value stat__value--ok">
                    {summary.removedCount > 0
                      ? formatDuration(summary.removedDuration)
                      : pluralize(summary.removableCount, 'trecho', 'trechos')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn--accent btn--block"
            onClick={onRemoveAll}
            disabled={!ready || summary.removableCount === 0}
          >
            <IconScissors size={15} /> Remover todos os silêncios
          </button>

          {summary.removedCount > 0 && (
            <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={onRestoreAll}>
              <IconRestore size={13} /> Restaurar todos os trechos removidos
            </button>
          )}
        </div>

        <div className="section">
          <div className="section__head">
            <span className="section__title">Ajustes</span>
            <IconWand size={14} />
          </div>

          <div className="preset-row">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset${matchesPreset(preset, settings) ? ' is-active' : ''}`}
                onClick={() => onSettings(preset.settings)}
                disabled={!ready}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="set-sensitivity">
                Sensibilidade
              </label>
              <span className="field__value">{sensitivity}%</span>
            </div>
            <input
              id="set-sensitivity"
              type="range"
              min={0}
              max={100}
              step={1}
              value={sensitivity}
              disabled={!ready}
              style={{ ['--fill' as string]: `${sensitivity}%` }}
              onChange={(event) => update({ thresholdDb: dbFromSensitivity(Number(event.target.value)) })}
            />
            <p className="field__hint">Quanto maior, mais trechos com som baixo são tratados como silêncio.</p>
          </div>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="set-threshold">
                Volume mínimo
              </label>
              <span className="field__value">{settings.thresholdDb.toFixed(1)} dB</span>
            </div>
            <input
              id="set-threshold"
              type="range"
              min={THRESHOLD_MIN_DB}
              max={THRESHOLD_MAX_DB}
              step={0.5}
              value={settings.thresholdDb}
              disabled={!ready}
              style={{
                ['--fill' as string]: `${((settings.thresholdDb - THRESHOLD_MIN_DB) / (THRESHOLD_MAX_DB - THRESHOLD_MIN_DB)) * 100}%`,
              }}
              onChange={(event) => update({ thresholdDb: Number(event.target.value) })}
            />
            <p className="field__hint">Tudo abaixo desse volume conta como silêncio.</p>
          </div>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="set-min">
                Duração mínima
              </label>
              <span className="field__value">{settings.minDuration.toFixed(2)} s</span>
            </div>
            <input
              id="set-min"
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={settings.minDuration}
              disabled={!ready}
              style={{ ['--fill' as string]: `${((settings.minDuration - 0.1) / 2.9) * 100}%` }}
              onChange={(event) => update({ minDuration: Number(event.target.value) })}
            />
            <p className="field__hint">Pausas mais curtas que isso são mantidas, para a fala não ficar picotada.</p>
          </div>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="set-padding">
                Margem do corte
              </label>
              <span className="field__value">{Math.round(settings.padding * 1000)} ms</span>
            </div>
            <input
              id="set-padding"
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={settings.padding}
              disabled={!ready}
              style={{ ['--fill' as string]: `${(settings.padding / 0.5) * 100}%` }}
              onChange={(event) => update({ padding: Number(event.target.value) })}
            />
            <p className="field__hint">Sobra preservada antes e depois de cada corte, para não cortar a respiração.</p>
          </div>
        </div>

        {silences.length > 0 && (
          <div className="section">
            <div className="section__head">
              <span className="section__title">Revisar trechos</span>
              <span className="stat__label">{pluralize(silences.length, 'trecho', 'trechos')}</span>
            </div>

            <div className="silence-list">
              {silences.map((entry, index) => {
                const { clip } = entry
                const classes = ['silence-row']
                if (clip.id === currentClipId) classes.push('is-current')
                if (clip.kept) classes.push('is-kept')
                if (!clip.enabled) classes.push('is-removed')
                return (
                  <div key={clip.id} className={classes.join(' ')}>
                    <button
                      type="button"
                      className="silence-row__jump"
                      onClick={() => onSeekToClip(clip.id)}
                      title="Ir para este trecho"
                    >
                      <span className="silence-row__time">
                        {index + 1}. {formatTime(clip.start)} → {formatTime(clip.end)}
                      </span>
                      <span className="silence-row__len">{clipDuration(clip).toFixed(2)}s de silêncio</span>
                    </button>
                    <div className="silence-row__actions">
                      <button
                        type="button"
                        className={`icon-btn${clip.kept ? ' is-on' : ''}`}
                        onClick={() => onToggleKeep(clip.id)}
                        title={clip.kept ? 'Voltar a considerar este silêncio' : 'Ignorar este silêncio nos cortes'}
                        aria-label={clip.kept ? 'Voltar a considerar este silêncio' : 'Ignorar este silêncio'}
                      >
                        {clip.kept ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </button>
                      <button
                        type="button"
                        className={`icon-btn${clip.enabled ? ' icon-btn--danger' : ' is-on'}`}
                        onClick={() => onToggleRemoved(clip.id)}
                        title={clip.enabled ? 'Remover este trecho' : 'Restaurar este trecho'}
                        aria-label={clip.enabled ? 'Remover este trecho' : 'Restaurar este trecho'}
                      >
                        {clip.enabled ? <IconTrash size={14} /> : <IconRestore size={14} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
