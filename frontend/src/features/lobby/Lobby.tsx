import { useState } from 'react'
import { API_URL } from '../../config'
import { safeJson } from '../../utils/safeJson'
import type { AuthUser } from '../../types'
import GlassSurface from '../../components/bits/GlassSurface'
import GradientText from '../../components/bits/GradientText'
import btnStyles from '../../shared/ui/buttons.module.css'
import inputStyles from '../../shared/ui/input.module.css'
import styles from './Lobby.module.css'

export interface LobbyProps {
  token: string | null
  user: AuthUser | null
  onJoinRoom: (id: string) => void
  onCreateRoom: (id: string) => void
}

export function Lobby({ token, user, onJoinRoom, onCreateRoom }: LobbyProps) {
  const [roomIdInput, setRoomIdInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!token) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const err = await safeJson<{ detail?: string }>(res)
        throw new Error(err?.detail || 'Не удалось создать комнату')
      }
      const data = await safeJson<{ room_id?: string }>(res)
      if (!data?.room_id) throw new Error('Неверный ответ сервера')
      onCreateRoom(data.room_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async () => {
    const id = roomIdInput.trim()
    if (!id || !token) return
    setJoining(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/rooms/${id}`)
      if (!res.ok) throw new Error('Комната не найдена')
      onJoinRoom(id)
    } catch {
      setError('Комната не найдена или неверный код')
    } finally {
      setJoining(false)
    }
  }

  if (!token) {
    return (
      <div className={styles.root}>
        <GlassSurface
          width={360}
          height={140}
          borderRadius={20}
          borderWidth={0.06}
          opacity={0.9}
          blur={12}
          className={styles.card}
          contentClassName={styles.cardMessageContent}
          style={{ width: '100%', maxWidth: '360px', minHeight: '140px' }}
        >
          <p className={styles.message}>Откройте приложение через бота в Telegram.</p>
        </GlassSurface>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <GlassSurface
        width={360}
        height={480}
        borderRadius={24}
        borderWidth={0.06}
        opacity={0.88}
        blur={12}
        className={styles.card}
        contentClassName={styles.cardContent}
        style={{ width: '100%', maxWidth: '360px', minHeight: '360px' }}
      >
        <div className={styles.cardInner}>
          <p className={styles.user}>
            <GradientText colors={['#e0f2fe', '#c4b5fd']} animationSpeed={6}>
              Привет, {user?.first_name || 'Участник'}!
            </GradientText>
          </p>
          <button
            type="button"
            className={`${btnStyles.btn} ${btnStyles.primary}`}
            onClick={() => onJoinRoom('main')}
          >
            Войти в общую комнату
          </button>
          <div className={styles.divider}>
            <GradientText colors={['#a5f3fc', '#818cf8']} animationSpeed={8}>
              или своя комната
            </GradientText>
          </div>
          <button
            type="button"
            className={`${btnStyles.btn} ${btnStyles.secondary}`}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Создаём…' : 'Создать комнату'}
          </button>
          <div className={styles.join}>
            <input
              type="text"
              className={inputStyles.input}
              placeholder="Код комнаты"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              type="button"
              className={`${btnStyles.btn} ${btnStyles.secondary}`}
              onClick={handleJoin}
              disabled={joining || !roomIdInput.trim()}
            >
              {joining ? '…' : 'Войти по коду'}
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </GlassSurface>
    </div>
  )
}
