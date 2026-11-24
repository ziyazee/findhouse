import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

// After a deploy, an open tab may ask for a page file that is gone. Reload once to pick up the new build.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  if (sessionStorage.getItem('findhouse_reloaded')) return
  sessionStorage.setItem('findhouse_reloaded', '1')
  window.location.reload()
})
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('findhouse_reloaded'), 10000))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
