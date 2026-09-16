import * as React from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

import { cn } from '@/lib/utils'

/**
 * A native <input type="date"> gives every device its own familiar picker
 * (calendar on desktop, wheel picker on mobile) — genuinely useful, so we
 * keep it — but its CLOSED-state text is rendered by the browser using the
 * OS locale, not anything the page controls: the same app showed DD/MM/YYYY
 * on one machine and MM/DD/YYYY on another. The real input stays mounted
 * (fully functional, keyboard/tap included) but invisible, stacked under a
 * plain div that always renders DD/MM/YYYY regardless of the visitor's
 * locale; clicking anywhere on the visible box clicks straight through to
 * the real input beneath it, opening the native picker as normal.
 */
export function formatDDMMYYYY(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface DateInputProps {
  id?: string
  className?: string
  required?: boolean
  ariaLabel?: string
  /** Spread from react-hook-form's `form.register('fieldName')` — pair
   * with `displayValue` (e.g. from `useWatch`) for the visible formatting,
   * since register's own uncontrolled binding doesn't expose a value here. */
  registration?: UseFormRegisterReturn
  displayValue?: string
  /** Plain controlled alternative to `registration` for forms not built on
   * react-hook-form (e.g. a simple useState filter). */
  value?: string
  onChange?: (value: string) => void
}

export function DateInput({ id, className, required, ariaLabel, registration, displayValue, value, onChange }: DateInputProps) {
  const display = formatDDMMYYYY(registration ? displayValue : value)
  const inputProps = registration ?? {
    value: value ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value),
  }

  return (
    <div className={cn('relative', className)}>
      <input
        type="date"
        id={id}
        required={required}
        aria-label={ariaLabel}
        className="absolute inset-0 z-10 h-9 w-full cursor-pointer opacity-0"
        {...inputProps}
      />
      <div
        className={cn(
          'pointer-events-none flex h-9 w-full items-center rounded-lg border border-border bg-card px-3 py-1 text-base text-foreground shadow-sm md:text-sm',
          !display && 'text-muted-foreground'
        )}
      >
        {display || 'DD/MM/YYYY'}
      </div>
    </div>
  )
}
