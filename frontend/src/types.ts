/** Пользователь из авторизации */
export interface AuthUser {
  id: number
  first_name: string
  username?: string
}

/** Результат авторизации через Telegram */
export interface AuthResult {
  token: string | null
  user: AuthUser | null
  bot_username: string | null
}

/** Информация об участнике в конференции */
export interface PeerInfo {
  displayName: string
  stream: MediaStream | null
  userId?: number | null
}
