'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  reset = () => this.setState({ error: null, errorInfo: null });

  override render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback;

    return (
      <div className="error-boundary-fallback">
        <div className="error-boundary-icon">
          <AlertTriangle size={32} />
        </div>
        <h2>Something went wrong</h2>
        <p>
          An unexpected error occurred in this section. Your data is safe.
          Refresh to try again, or use another part of Abhaya.
        </p>
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          onClick={this.reset}
        >
          Try again
        </Button>
      </div>
    );
  }
}
