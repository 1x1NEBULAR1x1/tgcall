import { API_URL } from '../config'
import type { AuthResult } from '../types'

/** Авторизация по initData из Telegram WebApp */
export async function authWithTelegram(): Promise<AuthResult> {
  const initData = window.Telegram?.WebApp?.initData
  if (!initData) return { token: null, user: null, bot_username: null }
  const res = await fetch(`${API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  })
  if (!res.ok) return { token: null, user: null, bot_username: null }
  const data = await res.json()
  return {
    token: data.token,
    user: data.user,
    bot_username: data.bot_username || null,
  }
}
