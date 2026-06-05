import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

/* ── Capture beforeinstallprompt BEFORE React mounts ──────────────────
   The browser fires this event very early — often before React even
   finishes hydrating. We capture it here at the module level so it
   is never missed, and store it on window for App.tsx to consume.
──────────────────────────────────────────────────────────────────── */
declare global {
  interface Window {
    __pwaInstallPrompt?: any;
    __pwaInstallReady?: boolean;
  }
}

window.__pwaInstallReady = false;
window.addEventListener('beforeinstallprompt', (e: any) => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
  window.__pwaInstallReady = true;
  // Notify any already-mounted React listeners
  window.dispatchEvent(new Event('pwa-install-ready'));
}, { once: true });

window.addEventListener('appinstalled', () => {
  window.__pwaInstallPrompt = undefined;
  window.__pwaInstallReady = false;
  window.dispatchEvent(new Event('pwa-install-done'));
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#F0F2F7', fontFamily: 'Plus Jakarta Sans, sans-serif',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1A1D2E', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: '0.78rem', color: '#9A9FB8', marginBottom: 24, maxWidth: 300 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '12px 28px',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
