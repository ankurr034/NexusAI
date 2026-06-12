import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // Telemetry capture as requested
    console.error(`[ErrorBoundary TELEMETRY] Component: ${this.props.componentName || 'Unknown'}`);
    console.error(`[ErrorBoundary TELEMETRY] Active Ticker: ${this.props.activeTicker || 'N/A'}`);
    console.error(`[ErrorBoundary TELEMETRY] Stack:`, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-2 h-full justify-center items-center text-center">
          <div className="flex flex-col items-center gap-2 text-red-400 font-bold text-sm">
            <AlertTriangle className="w-8 h-8 opacity-80" /> 
            Module Failure: {this.props.componentName || 'Component'}
          </div>
          <p className="text-xs text-red-400/70">The rest of the dashboard remains operational.</p>
          {import.meta.env.DEV && (
            <details className="text-left text-[10px] text-red-300 mt-2 p-3 bg-black/40 rounded-lg overflow-auto max-h-40 w-full font-mono">
               <summary className="cursor-pointer mb-1 font-bold">Debug Stack Trace</summary>
               {this.state.error?.toString()}
               <br />
               {this.state.errorInfo?.componentStack}
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
