import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-describedby' | 'aria-invalid'> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className = '', ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div>
      <label htmlFor={inputId} className="block text-base font-medium">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-sm text-slate-700">
          {hint}
        </p>
      ) : null}
      <input
        {...rest}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`mt-1 block min-h-11 w-full rounded border-2 px-3 text-base ${error ? 'border-red-700' : 'border-slate-500'} ${className}`}
      />
      {error ? (
        <p id={errorId} className="mt-1 flex gap-1 text-sm font-medium text-red-800">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
})
