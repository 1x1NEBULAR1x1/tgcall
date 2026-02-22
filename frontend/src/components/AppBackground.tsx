import LiquidChrome from './bits/LiquidChrome'

interface AppBackgroundProps {
  className?: string
  /** Упрощённый фон без WebGL — для страниц с тяжёлой GPU нагрузкой (видеозвонок) */
  simple?: boolean
}

const SIMPLE_BG_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(135deg, #1a1a24 0%, #0f0f12 50%, #1a1625 100%)',
}

export default function AppBackground({ className = '', simple = false }: AppBackgroundProps) {
  if (simple) {
    return <div className={className} style={SIMPLE_BG_STYLE} aria-hidden />
  }
  return (
    <div className={className} aria-hidden>
      <LiquidChrome
        baseColor={[0.12, 0.1, 0.14]}
        speed={0.1}
        amplitude={0.5}
        frequencyX={3}
        frequencyY={2}
        interactive={true}
      />
    </div>
  )
}
