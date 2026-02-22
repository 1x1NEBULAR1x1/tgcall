import LiquidChrome from './bits/LiquidChrome'

interface AppBackgroundProps {
  className?: string
  pixelFilter?: number
  spinSpeed?: number
}

export default function AppBackground({
  className = '',
}: AppBackgroundProps) {

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
