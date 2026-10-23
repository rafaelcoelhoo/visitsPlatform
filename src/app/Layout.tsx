import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'
import { signOut } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/api/authContext'
import { BRAND } from '@/config/brand'
import { Button } from '@/ui/Button'

export function Layout() {
  const { t } = useTranslation()
  const auth = useAuth()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus()
  }, [pathname])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-3"
      >
        {t('a11y.skipToContent')}
      </a>
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={BRAND.logoSrc} alt="" width={32} height={32} />
          <span className="text-lg font-semibold">{t('app.name')}</span>
        </div>
        {auth.status === 'signedIn' ? (
          <Button variant="secondary" onClick={() => void signOut()}>
            {t('auth.signOut')}
          </Button>
        ) : null}
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-3xl px-4 py-6 outline-none">
        <Outlet />
      </main>
    </>
  )
}
