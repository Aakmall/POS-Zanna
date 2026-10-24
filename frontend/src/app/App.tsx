import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes'
import { SafetyBoundary } from '../pwa/SafetyBoundary'
import { PageErrorBoundary } from '../components/ui/PageErrorBoundary'

export function App() {
  return (
    <BrowserRouter><PageErrorBoundary scope="app"><SafetyBoundary>
      <AppRoutes />
    </SafetyBoundary></PageErrorBoundary></BrowserRouter>
  )
}
