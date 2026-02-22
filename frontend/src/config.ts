/** Базовый URL API (без завершающего слэша) */
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/** URL для WebSocket: тот же хост, протокол http->ws, https->wss */
export function getWsUrl(path: string): string {
  const base = (API_URL || '').replace(/^https?:/, (p: string) => (p === 'https:' ? 'wss:' : 'ws:'))
  return base + path
}
