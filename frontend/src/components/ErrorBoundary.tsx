import { Component, type ErrorInfo, type ReactNode } from 'react'
import btnStyles from '../shared/ui/buttons.module.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  componentStack: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, componentStack: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState((s) => ({ ...s, componentStack: info.componentStack || '' }))
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReset = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      const { error, componentStack } = this.state
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            background: 'linear-gradient(135deg, #0f0f12 0%, #1a1a24 100%)',
            color: '#e4e4e7',
            fontFamily: 'monospace',
            fontSize: 11,
            overflow: 'auto',
          }}
        >
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Произошла ошибка</p>
          {error && (
            <pre
              style={{
                margin: 0,
                padding: 12,
                maxWidth: '90vw',
                maxHeight: 200,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 8,
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
              {error.stack && `\n\n${error.stack}`}
              {componentStack && `\n\n--- Component stack ---\n${componentStack}`}
            </pre>
          )}
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
