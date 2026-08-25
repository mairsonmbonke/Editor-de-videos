import type { Toast } from '../types'
import { IconAlert, IconCheck, IconInfo } from './icons'

const ICONS = { sucesso: IconCheck, erro: IconAlert, info: IconInfo }

export function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind]
        return (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            <Icon size={15} />
            <span>{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}
