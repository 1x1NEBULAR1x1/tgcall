import { useState, useEffect } from 'react'
import { authWithTelegram } from '../api/auth'
import type { AuthUser } from '../types'

export type AuthStatus = 'loading' | 'ok' | 'fail'

export interface UseAuthResult {
  token: string | null
  user: AuthUser | null
  botUsername: string | null
  authStatus: AuthStatus
}

/** Авторизация через Telegram при монтировании. Инициализирует WebApp. */
export function useAuth(): UseAuthResult {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [botUsername, setBotUsername] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      window.Telegram.WebApp.expand()
    }
  }, [])

  useEffect(() => {
    authWithTelegram().then(({ token: t, user: u, bot_username: b }) => {
      setToken(t)
      setUser(u)
      setBotUsername(b || null)
      setAuthStatus(t ? 'ok' : 'fail')
    })
  }, [])

  return { token, user, botUsername, authStatus }
}
