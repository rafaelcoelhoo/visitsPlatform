import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { BRAND } from '@/config/brand'

export function Layout() {
  const { t } = useTranslation()
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-3"
      >
        {t('a11y.skipToContent')}
      </a>
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <img src={BRAND.logoSrc} alt="" width={32} height={32} />
        <span className="text-lg font-semibold">{t('app.name')}</span>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </>
  )
}
