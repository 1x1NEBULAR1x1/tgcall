import { Component, type ErrorInfo, type ReactNode } from 'react'
import btnStyles from '../shared/ui/buttons.module.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReset = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            background: 'linear-gradient(135deg, #0f0f12 0%, #1a1a24 100%)',
            color: '#e4e4e7',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ margin: 0, fontSize: 18 }}>Произошла ошибка</p>
          <button
            type="button"
            className={`${btnStyles.btn} ${btnStyles.primary}`}
            onClick={this.handleReset}
          >
            Вернуться
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
