import { useEffect } from 'react'
import { BRAND } from '@/config/brand'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${BRAND.name}`
  }, [title])
}
