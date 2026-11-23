import { Component, type ReactNode } from 'react';

/** Keeps the rest of the app usable when a view fails to render (e.g. 3D without WebGL). */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return <div className="view3d-fail">Diese Ansicht konnte nicht angezeigt werden: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}
