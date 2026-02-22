/** Очередь ошибок до монтирования DebugProvider */
const queue: Array<{ type: 'error' | 'unhandledrejection'; message: string; stack?: string }> = []
let listener: ((type: 'error' | 'unhandledrejection', message: string, stack?: string) => void) | null = null

export function pushGlobalError(type: 'error' | 'unhandledrejection', message: string, stack?: string) {
  if (listener) {
    listener(type, message, stack)
  } else {
    queue.push({ type, message, stack })
  }
}

export function drainGlobalErrorQueue(
  addError: (type: 'error' | 'unhandledrejection', message: string, stack?: string) => void
) {
  listener = addError
  queue.forEach((e) => addError(e.type, e.message, e.stack))
  queue.length = 0
}
