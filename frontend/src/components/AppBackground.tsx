import Aurora from './bits/Aurora'

interface AppBackgroundProps {
  className?: string
}

export default function AppBackground({ className = '' }: AppBackgroundProps) {
  return (
    <div className={className} aria-hidden>
      <Aurora
        colorStops={["#4d2e4a", "#B19EEF", "#1e0e5d"]}
        speed={0.3}
        amplitude={0.5}
      />
    </div>
  )
}
