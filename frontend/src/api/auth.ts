import { API_URL } from '../config'
import type { AuthResult } from '../types'
import { safeJson } from '../utils/safeJson'

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
  const data = await safeJson<{ token?: string; user?: unknown; bot_username?: string }>(res)
  if (!data?.token) return { token: null, user: null, bot_username: null }
  return {
    token: data.token,
    user: data.user ?? null,
    bot_username: data.bot_username || null,
  }
}
