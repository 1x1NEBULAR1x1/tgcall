import btnStyles from '../../shared/ui/buttons.module.css'
import styles from './InviteModal.module.css'

interface InviteModalProps {
  inviteLink: string
  inviteLinkCopied: boolean
  onCopy: () => void
  onClose: () => void
}

export function InviteModal({
  inviteLink,
  inviteLinkCopied,
  onCopy,
  onClose,
}: InviteModalProps) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>
          Пригласить участников
        </h3>
        <p className={styles.text}>
          Отправьте ссылку в любой чат. Участник откроет бота и сможет присоединиться к звонку одним
          нажатием.
        </p>
        {inviteLink ? (
          <>
            <div className={styles.linkWrap}>
              <code className={styles.link}>{inviteLink}</code>
            </div>
            <button
              type="button"
              className={`${btnStyles.btn} ${btnStyles.primary} ${styles.copy}`}
              onClick={onCopy}
            >
              {inviteLinkCopied ? 'Скопировано' : 'Скопировать ссылку'}
            </button>
          </>
        ) : (
          <p className={styles.noBot}>
            Ссылка недоступна (не задан BOT_USERNAME на сервере).
          </p>
        )}
        <button
          type="button"
          className={`${btnStyles.btn} ${btnStyles.secondary} ${styles.close}`}
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}
