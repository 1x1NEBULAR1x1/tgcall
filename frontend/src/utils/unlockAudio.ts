/**
 * Разблокирует воспроизведение аудио в браузере.
 * Должен вызываться синхронно в обработчике клика (до любого await),
 * чтобы попасть в контекст "user activation".
 */
export function unlockAudio(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    // Игнорируем ошибки (старые браузеры и т.п.)
  }
}
