import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import { App } from './app/App'
import { appSafety } from './services/appSafety'
import { pwaRuntime } from './pwa/pwaRuntime'

void appSafety.start()
void pwaRuntime.start(import.meta.env.PROD, window.isSecureContext, navigator.serviceWorker, (probe) => appSafety.setClientProbe(probe))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
