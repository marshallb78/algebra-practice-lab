import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Top-level React error boundary preventing full-page crashes on unexpected runtime errors
 * while preserving the player's saved data in localStorage.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected display error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Matthew Clicker recovered from UI error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <h1 className="text-xl font-black tracking-wide text-cyan-300">
              Matthew Clicker Paused Safely
            </h1>
            <p className="text-sm text-slate-300">
              Your progress and skins are safely stored. Reload to resume right where you left off.
            </p>
            {this.state.errorMessage && (
              <p className="text-xs text-slate-400 font-mono break-words bg-slate-950/70 rounded-lg p-2">
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm transition"
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
