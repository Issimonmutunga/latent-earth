import { Component } from "react";

interface State {
  error: Error | null;
}

/** Last-resort fallback so a rendering bug never leaves a blank screen. */
export default class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <div className="crash__card">
          <h1>Something went wrong</h1>
          <p>Latent Earth hit an unexpected error. Reloading usually fixes it.</p>
          <pre>{this.state.error.message}</pre>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
