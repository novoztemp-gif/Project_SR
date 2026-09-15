// ─── Enums / Union Types ──────────────────────────────────────────────────────

/** Matches the product departments / nav sections */
export type Section =
  | 'glass'
  | 'plywood'
  | 'plumbing'
  | 'painting'
  | 'electrical'
  | 'hardware'

export type SectionType = 'Glass' | 'Plywood' | 'Plumbing' | 'Painting' | 'Electrical' | 'Hardware'

export type BillingRole = `billing_${string}`
export type Role = 'admin' | BillingRole

/** Maps each role to the sections it may access */
export const SECTION_ACCESS: Record<Role, Section[]> = {
  admin:     ['glass', 'plywood', 'plumbing', 'painting', 'electrical'],
  billing_b: ['plumbing', 'painting', 'electrical'],
  billing_a: ['glass', 'plywood'],
  billing_c: ['glass', 'plywood'],
  billing_d: ['plumbing', 'painting', 'electrical'],
  billing_e: ['glass', 'plywood'],
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string // ISO-8601
}

/** Public user shape returned by the backend (login / me / counters). */
export interface AuthUser extends User {
  label?: string | null
  initials?: string | null
  avatarColor?: string | null
  active: boolean
  process: SectionType[]
  /** Sections this user may access (admins get all). */
  sections: Section[]
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface Godown {
  id: string
  name: string
  location: string
}

export interface Product {
  id: string
  name: string
  spec?: string     // short spec string, e.g. "18mm · Marine · BWR"
  sku: string
  unit: string      // e.g. "kg", "pcs", "ltr"
  hsnCode: string
  taxRate: number   // percentage, e.g. 18
  section: Section
  godownId: string
  stock: number
  costPrice: number // per unit
  /** null = no selling price has been explicitly set yet. */
  salePrice: number | null // per unit (MRP / listed price)
  lowStockThreshold: number
  updatedAt: string // ISO-8601
}

export interface TransferLogEntry {
  id: string
  productId: string
  productName: string
  fromGodownId: string
  toGodownId: string
  qty: number
  transferredAt: string // ISO-8601
  transferredBy: string
}

// ─── Purchase ────────────────────────────────────────────────────────────────

export interface PurchaseItem {
  productId: string
  productName: string
  sizeDimension?: string
  quantity: number
  unit: string
  unitPrice: number // per unit (purchase price)
  salePrice?: number // per unit — what a brand-new product created from this item should sell for
  subtotal: number  // quantity * unitPrice
  godownId?: string // which godown this line's stock goes into
}

export interface PurchaseBill {
  id: string
  voucherNumber: string
  vendorName: string
  date: string      // ISO-8601
  section: Section
  godownId: string // legacy/display fallback — each item now carries its own godownId
  imageUrl?: string
  items: PurchaseItem[]
  subtotal: number
  total: number
  transportationAmount: number // default 0
  createdBy: string // User.id
  createdAt: string // ISO-8601
  printedAt: string | null
}

// ─── Sales / Billing ─────────────────────────────────────────────────────────

export interface SalesItem {
  productId: string
  productName: string  // snapshotted at bill time
  quantity: number
  unit: string         // snapshotted
  glassSize?: string
  model?: string
  sqFt?: number
  unitPrice: number    // per-sqft rate (Sq/-) when sqFt present; per-unit otherwise
  subtotal: number     // sqFt > 0 ? sqFt * unitPrice : quantity * unitPrice
  // Glass/plywood-only fabrication options — allowed values per field still TBD.
  arch?: string
  polishSide?: string
  polishName?: string
  cornerType?: string
  hole?: string
  artWork?: string
}

export type BillStatus = 'paid' | 'pending' | 'partial'

export interface SalesBill {
  id: string
  billNumber: number   // plain incrementing integer, e.g. 264
  date: string         // ISO-8601
  customerName?: string
  customerAddress?: string
  customerPhone: string
  bookingDate?: string
  deliveryDate?: string
  transport?: string
  transportTime?: string
  section: Section
  items: SalesItem[]
  subtotal: number
  total: number        // sum of item subtotals (pre-discount)
  transportationAmount: number // default 0
  discount: number     // default 0
  paidAmount: number   // default 0
  status: BillStatus   // explicit: paid | pending | partial
  // derived (not stored): finalAmount = total + transportationAmount - discount, balanceAmount = finalAmount - paidAmount
  billType: 'general' | 'glass_plywood' // default 'general'
  gpVoucherNumber?: string // e.g. "GP-2026-0001" — set only when billType is 'glass_plywood'
  createdBy: string    // User.id
  createdAt: string    // ISO-8601
}

export interface CreateBillInput {
  customerName?: string
  customerAddress?: string
  customerPhone: string
  bookingDate?: string
  deliveryDate?: string
  transport?: string
  transportTime?: string
  section: Section
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unit: string
    unitPrice: number
    glassSize?: string
    model?: string
    sqFt?: number
  }>
  transportationAmount?: number
  discount?: number
  paidAmount?: number
  billType?: 'general' | 'glass_plywood'
  createdBy: string
}
