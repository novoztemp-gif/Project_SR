import * as React from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Calendar } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A native <input type="date"> gives every device its own familiar picker
 * (calendar on desktop, wheel picker on mobile), but its CLOSED-state text
 * is rendered by the browser using the OS locale, not anything the page
 * controls — the same app showed DD/MM/YYYY on one machine and MM/DD/YYYY
 * on another.
 *
 * An earlier version fixed the display by stacking a visible DD/MM/YYYY
 * div on top of a fully invisible (opacity:0) native date input, letting
 * clicks pass through to it. That broke manual keyboard entry: a native
 * date input's typing target is segment-based (day/month/year, each
 * advancing on 2 digits), and with zero visible feedback — the real input
 * is transparent — a click could land on any segment and typed digits
 * filled in out of order (confirmed: typing "09222026" produced
 * "22026-02-09"). Picking via the calendar popup still worked, since that
 * commits a whole value at once regardless of where you clicked.
 *
 * This version is a real, visibly-editable text field with DD/MM/YYYY
 * input masking (typing digits auto-inserts the slashes, so you always see
 * what you're typing) plus a small calendar button that opens the native
 * date input's picker via showPicker() — the picker still bypasses locale
 * entirely, it just doesn't drive the visible field directly. Both paths
 * write to the same underlying native date input so react-hook-form's
 * registration (an onChange/ref pair meant for one real input) keeps
 * working unchanged.
 */
export function formatDDMMYYYY(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function parseDDMMYYYY(text: string): string {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, d, m, y] = match
  return `${y}-${m}-${d}`
}

/** Auto-inserts "/" as digits are typed: "22092026" -> "22/09/2026". */
function maskDDMMYYYY(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set

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
  const hiddenRef = React.useRef<HTMLInputElement>(null)
  const isoValue = registration ? displayValue : value
  const [text, setText] = React.useState(() => formatDDMMYYYY(isoValue))
  // While the field has focus, our own typing handler is the source of
  // truth for `text` — an external update landing mid-type (e.g. the
  // isoValue prop re-rendering a beat late) would otherwise stomp on
  // whatever the user is currently typing.
  const focusedRef = React.useRef(false)

  React.useEffect(() => {
    if (focusedRef.current) return
    setText(formatDDMMYYYY(isoValue))
  }, [isoValue])

  // Keeps the hidden native input's real DOM value aligned with whatever
  // the authoritative ISO value is, from any source (typing here, a scan
  // auto-fill, an external setValue) — so the calendar picker opens on the
  // right date and, for the registration path, react-hook-form itself
  // stays in sync without this component owning that state directly.
  React.useEffect(() => {
    const input = hiddenRef.current
    if (!input || !nativeValueSetter) return
    const iso = isoValue ?? ''
    if (input.value !== iso) {
      nativeValueSetter.call(input, iso)
    }
  }, [isoValue])

  function commitIso(iso: string) {
    const input = hiddenRef.current
    if (registration) {
      // Drive the hidden native input the same way a real user picking a
      // date would, so react-hook-form's own registered onChange fires
      // exactly as it already expects.
      if (input && nativeValueSetter) {
        nativeValueSetter.call(input, iso)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } else {
      onChange?.(iso)
    }
  }

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskDDMMYYYY(event.target.value)
    setText(masked)
    const iso = parseDDMMYYYY(masked)
    if (iso) commitIso(iso)
  }

  function handleFocus() {
    focusedRef.current = true
  }

  function handleBlur() {
    focusedRef.current = false
    // Snap back to the authoritative value — clears a half-typed date
    // that never became valid rather than leaving it stuck on screen.
    setText(formatDDMMYYYY(isoValue))
  }

  function openPicker() {
    const input = hiddenRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.focus()
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* The real, form-registered date input — kept only for
          react-hook-form's wiring and to drive the native calendar
          picker via showPicker(); never shown or typed into directly. */}
      {registration ? (
        <input
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          {...registration}
          ref={mergeRefs(hiddenRef, registration.ref)}
        />
      ) : (
        <input
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          value={value ?? ''}
          onChange={(event) => onChange?.(event.target.value)}
          ref={hiddenRef}
        />
      )}
      <input
        type="text"
        inputMode="numeric"
        id={id}
        required={required}
        aria-label={ariaLabel}
        placeholder="DD/MM/YYYY"
        value={text}
        onChange={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="flex h-9 w-full items-center rounded-lg border border-border bg-card px-3 py-1 pr-9 text-base text-foreground shadow-sm outline-none md:text-sm"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  )
}
