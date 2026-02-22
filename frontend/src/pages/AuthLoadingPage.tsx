
import AppBackground from '../components/AppBackground'
import { Loader } from '../shared/ui/Loader'
import styles from './AppLayout.module.css'

export function AuthLoadingPage() {
  return (
    <div className={styles.app}>
      <AppBackground className={styles.bg} />
      <div className={styles.content}>
        <Loader label="Подключение…" />
      </div>
    </div>
  )
}
