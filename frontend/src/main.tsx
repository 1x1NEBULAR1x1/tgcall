import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Ловим ошибки вне React (async, fetch, event handlers)
function showErrorOverlay(message: string, stack?: string) {
  const existing = document.getElementById('error-overlay-unhandled')
  if (existing) return
  const el = document.createElement('div')
  el.id = 'error-overlay-unhandled'
  el.style.cssText = `
    position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:12px;padding:24px;
    background:linear-gradient(135deg,#0f0f12,#1a1a24);color:#e4e4e7;
    font-family:monospace;font-size:11px;overflow:auto;
  `
  const text = stack ? `${message}\n\n${stack}` : message
  el.innerHTML = `
    <p style="font-size:16px;font-weight:600">Произошла ошибка</p>
    <pre style="margin:0;padding:12px;max-width:90vw;max-height:300px;overflow:auto;
      background:rgba(0,0,0,0.4);border-radius:8px;text-align:left;
      white-space:pre-wrap;word-break:break-word;">${text.replace(/</g, '&lt;')}</pre>
    <button onclick="window.location.href='/'" style="padding:10px 20px;cursor:pointer;border-radius:8px">Вернуться</button>
  `
  document.body.appendChild(el)
}
window.addEventListener('error', (e) => {
  showErrorOverlay(e.message, e.error?.stack)
})
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message ?? String(e.reason)
  const stack = e.reason?.stack
  showErrorOverlay(msg, stack)
  e.preventDefault()
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
