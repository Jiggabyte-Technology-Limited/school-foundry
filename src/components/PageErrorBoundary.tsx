import React from 'react';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class PageErrorBoundary extends React.Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  state: PageErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'Something went wrong while loading this page.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PageErrorBoundary]', error, errorInfo);
  }

  componentDidUpdate(prevProps: PageErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      // Reset the boundary when the visible page changes.
      // This lets users switch away and come back after a failure.
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="card"
          style={{
            margin: '24px',
            padding: '32px',
            border: '1px solid #fecaca',
            background: '#fff7f7',
            color: '#7f1d1d',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>This page could not load</h2>
          <p style={{ marginTop: 0, color: '#991b1b' }}>
            {this.state.message || 'An unexpected error occurred.'}
          </p>
          <p style={{ marginBottom: 0, color: '#7f1d1d' }}>
            Try switching to another section and back again. If the problem keeps happening, the
            page logic needs a follow-up fix.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PageErrorBoundary;
