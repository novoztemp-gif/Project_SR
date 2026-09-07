import type { Godown, Section, User } from '@/types'

// ─── Section metadata ────────────────────────────────────────────────────────

export interface SectionMeta {
  key: Section
  label: string
  colorVar: string // CSS custom property name (without --)
}

export const SECTIONS: SectionMeta[] = [
  { key: 'glass',      label: 'Glass',      colorVar: '--section-glass' },
  { key: 'plywood',    label: 'Plywood',    colorVar: '--section-plywood' },
  { key: 'plumbing',   label: 'Plumbing',   colorVar: '--section-plumbing' },
  { key: 'painting',   label: 'Painting',   colorVar: '--section-painting' },
  { key: 'electrical', label: 'Electrical', colorVar: '--section-electrical' },
  { key: 'hardware',   label: 'Hardware',   colorVar: '--section-hardware' },
]

export const SECTION_COLORS: Record<string, string> = {
  Glass: '#4FC3F7',
  Plywood: '#FFB74D',
  Plumbing: '#81C784',
  Painting: '#F06292',
  Electrical: '#FFD54F',
  Hardware: '#90A4AE',
}

export interface MeasurementPreset {
  label: string
  value: string
}

export const MEASUREMENT_PRESETS: Record<string, MeasurementPreset[]> = {
  Glass: [
    { label: '2×3 ft', value: '2×3 ft' },
    { label: '3×4 ft', value: '3×4 ft' },
    { label: '4×4 ft', value: '4×4 ft' },
    { label: '4×6 ft', value: '4×6 ft' },
    { label: '5×7 ft', value: '5×7 ft' },
    { label: '6×8 ft', value: '6×8 ft' },
    { label: '6×10 ft', value: '6×10 ft' },
    { label: '8×10 ft', value: '8×10 ft' },
    { label: '8×12 ft', value: '8×12 ft' },
    { label: '10×12 ft', value: '10×12 ft' },
    { label: '12×12 ft', value: '12×12 ft' },
  ],
  Plywood: [
    { label: '6×4 ft (Standard)', value: '6×4 ft' },
    { label: '8×4 ft', value: '8×4 ft' },
    { label: '7×4 ft', value: '7×4 ft' },
    { label: '6×3 ft', value: '6×3 ft' },
    { label: '4×4 ft', value: '4×4 ft' },
    { label: '8×3 ft', value: '8×3 ft' },
    { label: '10×4 ft', value: '10×4 ft' },
    { label: '12×4 ft', value: '12×4 ft' },
  ],
  Plumbing: [
    { label: '0.5 inch', value: '0.5"' },
    { label: '0.75 inch', value: '0.75"' },
    { label: '1 inch', value: '1"' },
    { label: '1.25 inch', value: '1.25"' },
    { label: '1.5 inch', value: '1.5"' },
    { label: '2 inch', value: '2"' },
    { label: '2.5 inch', value: '2.5"' },
    { label: '3 inch', value: '3"' },
    { label: '4 inch', value: '4"' },
    { label: '6 inch', value: '6"' },
    { label: '1m', value: '1m' },
    { label: '2m', value: '2m' },
    { label: '3m', value: '3m' },
    { label: '5m', value: '5m' },
  ],
  Painting: [
    { label: '1 Liter', value: '1L' },
    { label: '2 Liter', value: '2L' },
    { label: '4 Liter', value: '4L' },
    { label: '10 Liter', value: '10L' },
    { label: '20 Liter', value: '20L' },
    { label: '200ml', value: '200ml' },
    { label: '500ml', value: '500ml' },
    { label: '1 Kg', value: '1kg' },
    { label: '5 Kg', value: '5kg' },
    { label: '10 Kg', value: '10kg' },
    { label: '25 Kg', value: '25kg' },
  ],
  Electrical: [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '15m', value: '15m' },
    { label: '20m', value: '20m' },
    { label: '50m', value: '50m' },
    { label: '100m', value: '100m' },
    { label: '2A', value: '2A' },
    { label: '5A', value: '5A' },
    { label: '6A', value: '6A' },
    { label: '10A', value: '10A' },
    { label: '16A', value: '16A' },
    { label: '20A', value: '20A' },
    { label: '32A', value: '32A' },
  ],
  Hardware: [
    { label: '1 inch', value: '1"' },
    { label: '1.5 inch', value: '1.5"' },
    { label: '2 inch', value: '2"' },
    { label: '3 inch', value: '3"' },
    { label: '4 inch', value: '4"' },
    { label: '6 inch', value: '6"' },
    { label: 'Small', value: 'Small' },
    { label: 'Medium', value: 'Medium' },
    { label: 'Large', value: 'Large' },
  ],
}

// ─── Seed data ───────────────────────────────────────────────────────────────

export const GODOWNS_SEED: Godown[] = [
  { id: 'gd-1', name: 'Main Godown',   location: 'Ground floor, Block A' },
  { id: 'gd-2', name: 'Annexe A',      location: 'First floor, Block A' },
  { id: 'gd-3', name: 'Annexe B',      location: 'First floor, Block B' },
  { id: 'gd-4', name: 'Top Floor',     location: 'Second floor, Block A' },
  { id: 'gd-5', name: 'Outdoor Yard',  location: 'Rear compound' },
]

export const MOCK_USERS: User[] = [
  {
    id: 'u-3',
    name: 'Subramaniam V.',
    email: 'subbu@hardwareco.in',
    role: 'admin',
    createdAt: '2023-06-01T09:00:00.000Z',
  },
]
