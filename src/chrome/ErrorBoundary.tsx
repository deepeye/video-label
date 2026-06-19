import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DemoCrashScreen } from './DemoCrashScreen';

interface State {
  hasError: boolean;
}

interface Props {
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 错误信息进 console 而非 UI (spec §7.3.2)
    console.error('[Demo crash]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <DemoCrashScreen />;
    }
    return this.props.children;
  }
}
