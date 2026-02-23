import styles from './Loader.module.css'

interface LoaderProps {
  label?: string
}

export function Loader({ label = 'Загрузка…' }: LoaderProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.loader} />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
