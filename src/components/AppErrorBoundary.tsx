import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] render crash:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <section
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            background: '#f5f6f8',
            color: '#2f3640',
            fontFamily: 'Poppins, sans-serif',
            textAlign: 'center'
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600 }}>Delta hit a render error</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#5f6874' }}>
              Please refresh. If it persists, clear local storage and try again.
            </p>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
