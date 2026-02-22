import GradientText from '../../components/bits/GradientText'
import styles from './Loader.module.css'

interface LoaderProps {
  label?: string
}

export function Loader({ label = 'Загрузка…' }: LoaderProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.loader} />
      <span className={styles.label}>
        <GradientText colors={['#7df9ff', '#C084FC']} animationSpeed={5}>
          {label}
        </GradientText>
      </span>
    </div>
  )
}
