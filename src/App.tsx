import { useCallback, useEffect, useState } from 'react'
import { Login } from './components/Login'
import { Editor } from './components/Editor'

const SESSION_KEY = 'cortex.sessao'

export function App() {
  const [user, setUser] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) setUser(stored)
    } catch {
      // Navegador com armazenamento bloqueado: segue sem sessão salva.
    }
  }, [])

  const enter = useCallback((name: string) => {
    setUser(name)
    try {
      localStorage.setItem(SESSION_KEY, name)
    } catch {
      /* sem persistência */
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* sem persistência */
    }
  }, [])

  return user ? <Editor user={user} onLogout={logout} /> : <Login onEnter={enter} />
}
