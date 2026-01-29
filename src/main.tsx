import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SimpleErrorBoundary from './components/SimpleErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SimpleErrorBoundary>
      <App />
    </SimpleErrorBoundary>
  </StrictMode>,
)
