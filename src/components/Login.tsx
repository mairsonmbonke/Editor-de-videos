import { useState } from 'react'
import { IconAlert, IconFilm, IconLock } from './icons'

interface LoginProps {
  onEnter: (name: string) => void
}

/** Login local: guarda apenas o nome da sessão, sem enviar nada para fora. */
export function Login({ onEnter }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Informe seu e-mail para entrar.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Esse e-mail não parece válido.')
      return
    }
    if (password.length < 4) {
      setError('A senha precisa ter pelo menos 4 caracteres.')
      return
    }
    setError('')
    onEnter(trimmed)
  }

  return (
    <div className="login">
      <div className="login__grid" />
      <div className="login__card">
        <div className="login__brand">
          <span className="login__mark">
            <IconFilm size={21} />
          </span>
          <div>
            <div className="login__name">Cortex</div>
            <div className="login__tag">Editor de vídeo com corte automático</div>
          </div>
        </div>

        <h1 className="login__title">Entrar</h1>
        <p className="login__lead">
          Corte todos os silêncios do seu vídeo em segundos. Tudo roda no seu navegador — nenhum arquivo é enviado
          para servidores.
        </p>

        <form className="login__form" onSubmit={submit} noValidate>
          {error && (
            <div className="login__error" role="alert">
              <IconAlert size={15} />
              {error}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="login-email">
              E-mail
            </label>
            <input
              id="login-email"
              className="text-input"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="login-password">
              Senha
            </label>
            <input
              id="login-password"
              className="text-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button type="submit" className="btn btn--primary login__submit">
            Entrar no editor
          </button>
        </form>

        <div className="login__features">
          <span className="login__chip">Detecção automática</span>
          <span className="login__chip">Waveform na timeline</span>
          <span className="login__chip">Exportação MP4</span>
        </div>

        <p className="login__note">
          <IconLock size={12} /> Sessão local de demonstração. Qualquer e-mail válido e uma senha de 4 caracteres
          funcionam — os vídeos nunca saem do seu computador.
        </p>
      </div>
    </div>
  )
}
