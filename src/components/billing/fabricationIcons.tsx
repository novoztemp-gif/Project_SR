import type { ReactNode } from 'react'

// Shared Arch/Polish-Side icon set — used both by the interactive
// IconOptionPicker (BillLineItem.tsx) and the Glass/Plywood print
// templates, so the on-screen picker and the printed voucher always show
// the exact same shape for a given value. `size` picks a smaller variant
// for the print tables without touching the picker's larger tiles.

interface IconSizeProps {
  size?: 'sm' | 'lg'
}

export function ArchTopIcon({ size = 'lg' }: IconSizeProps) {
  return (
    <svg viewBox="0 0 32 40" className={size === 'lg' ? 'h-8 w-6' : 'h-4 w-3'} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 38 V17 A13 13 0 0 1 29 17 V38" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FlatSquareIcon({ size = 'lg' }: IconSizeProps) {
  return (
    <svg viewBox="0 0 32 40" className={size === 'lg' ? 'h-8 w-6' : 'h-4 w-3'} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="2" width="26" height="36" rx="1" />
    </svg>
  )
}

// Short double-tick mark crossing one edge of a rectangle — the
// hand-drawn sketch's way of showing "this edge is polished."
type TickLine = [number, number, number, number]

// Straight, perpendicular to the edge they cross — a slant here (tried
// previously) made opposite/adjacent edge marks visually line up into
// what read as one continuous diagonal stroke across the whole shape.
function EdgeTicks({ edge }: { edge: 'top' | 'bottom' | 'left' | 'right' }) {
  const lines: TickLine[] = {
    top: [[16, 0, 16, 9], [22, 0, 22, 9]],
    bottom: [[16, 23, 16, 32], [22, 23, 22, 32]],
    left: [[0, 11, 9, 11], [0, 19, 9, 19]],
    right: [[31, 11, 40, 11], [31, 19, 40, 19]],
  }[edge] as TickLine[]
  return (
    <>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={2.25} strokeLinecap="round" />
      ))}
    </>
  )
}

export function PolishRectIcon({ edges, size = 'lg' }: { edges: Array<'top' | 'bottom' | 'left' | 'right'> } & IconSizeProps) {
  return (
    <svg viewBox="0 0 40 32" className={size === 'lg' ? 'h-7 w-9' : 'h-4 w-5'} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="2" y="4" width="36" height="24" rx="1" />
      {edges.map((edge) => (
        <EdgeTicks key={edge} edge={edge} />
      ))}
    </svg>
  )
}

// Circle with tick pairs at top, bottom, left, and right — same
// convention as the rectangle/oval "all side" icons.
export function PolishRoundIcon({ size = 'lg' }: IconSizeProps) {
  return (
    <svg viewBox="0 0 32 32" className={size === 'lg' ? 'h-7 w-7' : 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="16" cy="16" r="13" />
      <line x1="13" y1="0" x2="13" y2="8" strokeWidth={2.25} strokeLinecap="round" />
      <line x1="19" y1="0" x2="19" y2="8" strokeWidth={2.25} strokeLinecap="round" />
      <line x1="13" y1="24" x2="13" y2="32" strokeWidth={2.25} strokeLinecap="round" />
      <line x1="19" y1="24" x2="19" y2="32" strokeWidth={2.25} strokeLinecap="round" />
      <line x1="0" y1="13" x2="8" y2="13" strokeWidth={2.25} strokeLinecap="round" />
      <line x1="0" y1="19" x2="8" y2="19" strokeWidth={2.25} strokeLinecap="round" />
      <line x1="24" y1="13" x2="32" y2="13" strokeWidth={2.25} strokeLinecap="round" />
      <line x1="24" y1="19" x2="32" y2="19" strokeWidth={2.25} strokeLinecap="round" />
    </svg>
  )
}

export function PolishOvalIcon({ marks = [], size = 'lg' }: { marks?: Array<'top' | 'bottom' | 'left' | 'right'> } & IconSizeProps) {
  const has = (edge: 'top' | 'bottom' | 'left' | 'right') => marks.includes(edge)
  return (
    <svg viewBox="0 0 48 24" className={size === 'lg' ? 'h-6 w-10' : 'h-3 w-5'} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="2" y="2" width="44" height="20" rx="10" />
      {has('left') && (
        <>
          <line x1="2" y1="8" x2="9" y2="10" strokeWidth={2.25} strokeLinecap="round" />
          <line x1="2" y1="16" x2="9" y2="14" strokeWidth={2.25} strokeLinecap="round" />
        </>
      )}
      {has('right') && (
        <>
          <line x1="46" y1="8" x2="39" y2="10" strokeWidth={2.25} strokeLinecap="round" />
          <line x1="46" y1="16" x2="39" y2="14" strokeWidth={2.25} strokeLinecap="round" />
        </>
      )}
      {has('top') && (
        <>
          <line x1="20" y1="0" x2="20" y2="7" strokeWidth={2.25} strokeLinecap="round" />
          <line x1="28" y1="0" x2="28" y2="7" strokeWidth={2.25} strokeLinecap="round" />
        </>
      )}
      {has('bottom') && (
        <>
          <line x1="20" y1="17" x2="20" y2="24" strokeWidth={2.25} strokeLinecap="round" />
          <line x1="28" y1="17" x2="28" y2="24" strokeWidth={2.25} strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function buildPolishSideIcons(size: 'sm' | 'lg'): Record<string, ReactNode> {
  return {
    'four-side': <PolishRectIcon size={size} edges={['top', 'bottom', 'left', 'right']} />,
    'one-side-bottom': <PolishRectIcon size={size} edges={['bottom']} />,
    'one-side-top': <PolishRectIcon size={size} edges={['top']} />,
    'one-side-right': <PolishRectIcon size={size} edges={['right']} />,
    'one-side-left': <PolishRectIcon size={size} edges={['left']} />,
    'two-side-tb': <PolishRectIcon size={size} edges={['top', 'bottom']} />,
    'two-side-lr': <PolishRectIcon size={size} edges={['left', 'right']} />,
    'round-all': <PolishRoundIcon size={size} />,
    'oval-plain': <PolishOvalIcon size={size} />,
    'oval-all': <PolishOvalIcon size={size} marks={['top', 'bottom', 'left', 'right']} />,
  }
}

export const ARCH_ICONS: Record<string, ReactNode> = {
  'arch-top': <ArchTopIcon />,
  'flat-square': <FlatSquareIcon />,
}

export const ARCH_ICONS_SMALL: Record<string, ReactNode> = {
  'arch-top': <ArchTopIcon size="sm" />,
  'flat-square': <FlatSquareIcon size="sm" />,
}

export const POLISH_SIDE_ICONS: Record<string, ReactNode> = buildPolishSideIcons('lg')
export const POLISH_SIDE_ICONS_SMALL: Record<string, ReactNode> = buildPolishSideIcons('sm')
