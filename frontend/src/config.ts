/** Базовый URL API (без завершающего слэша). Пустой = same-origin (относительные пути) */
const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
export const API_URL = envUrl || ''

/** URL для WebSocket. Safari требует абсолютный URL (wss://host/path), относительный не работает. */
export function getWsUrl(path: string): string {
  if (API_URL) {
    const base = API_URL.replace(/^https?:/, (p: string) => (p === 'https:' ? 'wss:' : 'ws:'))
    return base + path
  }
  const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof location !== 'undefined' ? location.host : ''
  return `${proto}//${host}${path.startsWith('/') ? path : '/' + path}`
}
