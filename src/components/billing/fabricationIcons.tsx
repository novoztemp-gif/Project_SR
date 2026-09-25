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

// A plain straight edge — no curve, unlike ArchTopIcon — same springline
// height (y=17) as the arch's own so the two read as a matched pair: one
// bowed, one flat.
export function FlatSquareIcon({ size = 'lg' }: IconSizeProps) {
  return (
    <svg viewBox="0 0 32 40" className={size === 'lg' ? 'h-8 w-6' : 'h-4 w-3'} fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="17" x2="29" y2="17" strokeLinecap="round" />
    </svg>
  )
}

// Each selected edge draws as an open bracket — the edge itself plus a
// short perpendicular tab at each end, e.g. "[" for the left edge alone —
// rather than a filled-in tick mark over a background rectangle. With no
// background rectangle, only the actual selected edge(s) render; select all
// four and the brackets' tabs meet at every corner, reading as one full
// rectangle outline.
function EdgeBracket({ edge }: { edge: 'top' | 'bottom' | 'left' | 'right' }) {
  const d: Record<'top' | 'bottom' | 'left' | 'right', string> = {
    left: 'M8 4 L2 4 L2 28 L8 28',
    right: 'M32 4 L38 4 L38 28 L32 28',
    top: 'M2 10 L2 4 L38 4 L38 10',
    bottom: 'M2 22 L2 28 L38 28 L38 22',
  }
  return <path d={d[edge]} strokeLinecap="round" strokeLinejoin="round" />
}

export function PolishRectIcon({ edges, size = 'lg' }: { edges: Array<'top' | 'bottom' | 'left' | 'right'> } & IconSizeProps) {
  return (
    <svg viewBox="0 0 40 32" className={size === 'lg' ? 'h-7 w-9' : 'h-4 w-5'} fill="none" stroke="currentColor" strokeWidth="2">
      {edges.map((edge) => (
        <EdgeBracket key={edge} edge={edge} />
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
