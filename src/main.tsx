import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18n from '@/lib/i18n'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Elemento #root não encontrado')

try {
  const { App } = await import('@/app/App')
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  console.error(error)
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.className = 'p-4'
  message.textContent = i18n.t('app.startupError')
  container.replaceChildren(message)
}
