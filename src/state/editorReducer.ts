import type { Clip, MediaAsset, SilenceSettings } from '../types'
import { DEFAULT_SETTINGS } from '../lib/silence'
import { MIN_CLIP_DURATION, moveClip, splitClip } from '../lib/clips'

export interface Snapshot {
  clips: Clip[]
  settings: SilenceSettings
}

export interface HistoryEntry {
  snapshot: Snapshot
  /** Descrição da ação que levou a este estado, mostrada em Desfazer/Refazer. */
  label: string
}

export interface ProjectHistory {
  past: HistoryEntry[]
  present: HistoryEntry
  future: HistoryEntry[]
}

export interface EditorState {
  assets: MediaAsset[]
  activeId: string | null
  projects: Record<string, ProjectHistory>
}

export const initialEditorState: EditorState = { assets: [], activeId: null, projects: {} }

/** Limite do histórico — evita crescer sem controle em sessões longas. */
const HISTORY_LIMIT = 100

export type EditorAction =
  | { type: 'assets/add'; assets: MediaAsset[]; clips: Record<string, Clip[]> }
  | { type: 'assets/update'; id: string; patch: Partial<MediaAsset> }
  | { type: 'assets/remove'; id: string }
  | { type: 'assets/select'; id: string }
  | { type: 'project/reset'; id: string; clips: Clip[]; settings: SilenceSettings; label: string }
  | { type: 'settings/change'; settings: SilenceSettings }
  | { type: 'clips/set'; clips: Clip[]; label: string }
  | { type: 'clips/patch'; id: string; patch: Partial<Clip>; label: string }
  | { type: 'clips/split'; index: number; sourceTime: number }
  | { type: 'clips/delete'; index: number }
  | { type: 'clips/move'; index: number; steps: number }
  | { type: 'history/undo' }
  | { type: 'history/redo' }

function newHistory(snapshot: Snapshot, label: string): ProjectHistory {
  return { past: [], present: { snapshot, label }, future: [] }
}

function commit(history: ProjectHistory, snapshot: Snapshot, label: string): ProjectHistory {
  const past = [...history.past, history.present]
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: { snapshot, label },
    future: [],
  }
}

function withProject(
  state: EditorState,
  update: (history: ProjectHistory) => ProjectHistory | null,
): EditorState {
  const id = state.activeId
  if (!id) return state
  const history = state.projects[id]
  if (!history) return state
  const next = update(history)
  if (!next || next === history) return state
  return { ...state, projects: { ...state.projects, [id]: next } }
}

function commitClips(state: EditorState, label: string, build: (clips: Clip[]) => Clip[] | null): EditorState {
  return withProject(state, (history) => {
    const clips = build(history.present.snapshot.clips)
    if (!clips) return null
    return commit(history, { ...history.present.snapshot, clips }, label)
  })
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'assets/add': {
      const projects = { ...state.projects }
      for (const asset of action.assets) {
        projects[asset.id] = newHistory(
          { clips: action.clips[asset.id] ?? [], settings: DEFAULT_SETTINGS },
          'Vídeo importado',
        )
      }
      return {
        assets: [...state.assets, ...action.assets],
        activeId: state.activeId ?? action.assets[0]?.id ?? null,
        projects,
      }
    }

    case 'assets/update':
      return {
        ...state,
        assets: state.assets.map((asset) => (asset.id === action.id ? { ...asset, ...action.patch } : asset)),
      }

    case 'assets/remove': {
      const assets = state.assets.filter((asset) => asset.id !== action.id)
      const projects = { ...state.projects }
      delete projects[action.id]
      return {
        assets,
        projects,
        activeId: state.activeId === action.id ? (assets[0]?.id ?? null) : state.activeId,
      }
    }

    case 'assets/select':
      return state.activeId === action.id ? state : { ...state, activeId: action.id }

    case 'project/reset':
      return {
        ...state,
        projects: {
          ...state.projects,
          [action.id]: commit(
            state.projects[action.id] ?? newHistory({ clips: action.clips, settings: action.settings }, action.label),
            { clips: action.clips, settings: action.settings },
            action.label,
          ),
        },
      }

    case 'settings/change':
      // Ajustar os controles não entra no histórico: só a nova análise entra.
      return withProject(state, (history) => ({
        ...history,
        present: {
          ...history.present,
          snapshot: { ...history.present.snapshot, settings: action.settings },
        },
      }))

    case 'clips/set':
      return commitClips(state, action.label, () => action.clips)

    case 'clips/patch':
      return commitClips(state, action.label, (clips) => {
        let changed = false
        const next = clips.map((clip) => {
          if (clip.id !== action.id) return clip
          changed = true
          return { ...clip, ...action.patch }
        })
        return changed ? next : null
      })

    case 'clips/split':
      return commitClips(state, 'Dividir bloco', (clips) => splitClip(clips, action.index, action.sourceTime))

    case 'clips/delete':
      return commitClips(state, 'Excluir bloco', (clips) => {
        const clip = clips[action.index]
        if (!clip) return null
        // Silêncios detectados viram "removidos" para poderem ser restaurados;
        // blocos manuais saem da linha do tempo de vez.
        if (clip.isSilence) {
          return clips.map((item, index) => (index === action.index ? { ...item, enabled: false } : item))
        }
        const next = clips.filter((_, index) => index !== action.index)
        return next.length > 0 ? next : null
      })

    case 'clips/move':
      return commitClips(state, 'Mover bloco', (clips) => moveClip(clips, action.index, action.steps))

    case 'history/undo':
      return withProject(state, (history) => {
        const previous = history.past[history.past.length - 1]
        if (!previous) return null
        return {
          past: history.past.slice(0, -1),
          present: previous,
          future: [history.present, ...history.future],
        }
      })

    case 'history/redo':
      return withProject(state, (history) => {
        const [next, ...rest] = history.future
        if (!next) return null
        return { past: [...history.past, history.present], present: next, future: rest }
      })

    default:
      return state
  }
}

/** Blocos com duração desprezível atrapalham a reprodução; descarta-os. */
export function sanitizeClips(clips: Clip[]): Clip[] {
  return clips.filter((clip) => clip.end - clip.start >= MIN_CLIP_DURATION)
}
