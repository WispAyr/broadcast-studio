import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || 'Unknown', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // For screen modules, render a subtle dark fallback instead of crashing the whole screen
      if (this.props.silent) {
        return (
          <div style={{
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#444', fontSize: '0.7rem', fontFamily: 'monospace' }}>
              Module Error
            </span>
          </div>
        );
      }

      return (
        <div style={{
          padding: '1rem',
          background: 'rgba(220,38,38,0.1)',
          border: '1px solid rgba(220,38,38,0.3)',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '0.8rem',
        }}>
          <strong>{this.props.name || 'Component'} Error</strong>
          <p style={{ color: '#888', marginTop: '4px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
