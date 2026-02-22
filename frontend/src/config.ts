/** Базовый URL API (без завершающего слэша). Пустой = same-origin (относительные пути) */
const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
export const API_URL = envUrl || ''

/** URL для WebSocket: тот же хост, протокол http->ws, https->wss */
export function getWsUrl(path: string): string {
  if (!API_URL) return path
  const base = API_URL.replace(/^https?:/, (p: string) => (p === 'https:' ? 'wss:' : 'ws:'))
  return base + path
}
