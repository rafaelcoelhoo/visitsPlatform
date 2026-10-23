import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ptPT } from '@/i18n/pt-PT'

export const defaultNS = 'translation'
export const resources = { 'pt-PT': { translation: ptPT } } as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'pt-PT',
  fallbackLng: 'pt-PT',
  defaultNS,
  interpolation: { escapeValue: false },
})

export default i18n
