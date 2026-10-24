import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes'
import { SafetyBoundary } from '../pwa/SafetyBoundary'

export function App() {
  return (
    <SafetyBoundary><BrowserRouter>
      <AppRoutes />
    </BrowserRouter></SafetyBoundary>
  )
}
