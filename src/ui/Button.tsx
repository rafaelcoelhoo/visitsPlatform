import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const VARIANTS = {
  primary: 'bg-brand-700 text-white',
  secondary: 'border-2 border-slate-500 bg-white text-ink',
} as const

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded px-4 text-base font-medium disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  )
}
