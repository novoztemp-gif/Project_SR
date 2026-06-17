import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, type Section } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin123'
const COUNTER_PASSWORD = process.env.SEED_COUNTER_PASSWORD ?? 'counter123'

const SECTION_BY_TYPE: Record<string, Section> = {
  Glass: 'glass',
  Plywood: 'plywood',
  Plumbing: 'plumbing',
  Painting: 'painting',
  Electrical: 'electrical',
}

// ─── Godowns ───────────────────────────────────────────────────────────────────
const GODOWNS = [
  { id: 'gd-1', name: 'Main Godown', location: 'Ground floor, Block A' },
  { id: 'gd-2', name: 'Annexe A', location: 'First floor, Block A' },
  { id: 'gd-3', name: 'Annexe B', location: 'First floor, Block B' },
  { id: 'gd-4', name: 'Top Floor', location: 'Second floor, Block A' },
  { id: 'gd-5', name: 'Outdoor Yard', location: 'Rear compound' },
]

// ─── Counters (billing users) + admin owner ─────────────────────────────────────
const COUNTERS = [
  { id: 'billing_a', name: 'Karthikeyan S.', initials: 'KS', label: 'COUNTER 1', process: ['Glass', 'Plywood'], avatarColor: 'deep' },
  { id: 'billing_b', name: 'Meenakshi R.', initials: 'MR', label: 'COUNTER 2', process: ['Plumbing', 'Painting', 'Electrical'], avatarColor: 'mint' },
  { id: 'billing_c', name: 'Rajan M.', initials: 'RM', label: 'COUNTER 3', process: ['Glass', 'Plywood'], avatarColor: 'leaf' },
  { id: 'billing_d', name: 'Priya K.', initials: 'PK', label: 'COUNTER 4', process: ['Plumbing', 'Painting', 'Electrical'], avatarColor: 'forest' },
  { id: 'billing_e', name: 'Selvam T.', initials: 'ST', label: 'COUNTER 5', process: ['Glass', 'Plywood'], avatarColor: 'highlight' },
]

// ─── Products (original ids preserved — bills/purchases reference them) ───────────
const PRODUCTS = [
  { id: 'p-05', name: '8mm Toughened Glass', spec: '8mm · Toughened · Clear', sku: 'GLS-08MM-TG', unit: 'sheet', hsnCode: '7005', taxRate: 18, section: 'glass', godownId: 'gd-1', stock: 15, costPrice: 4500, salePrice: 5200, lowStockThreshold: 5 },
  { id: 'p-06', name: '5mm Mirror Glass', spec: '5mm · Mirror · Silvered', sku: 'GLS-05MM-MIR', unit: 'sheet', hsnCode: '7009', taxRate: 18, section: 'glass', godownId: 'gd-1', stock: 3, costPrice: 1200, salePrice: 1450, lowStockThreshold: 8 },
  { id: 'p-40b', name: '10mm Float Glass', spec: '10mm · Float · Clear', sku: 'GLS-10MM-FL', unit: 'sheet', hsnCode: '7005', taxRate: 18, section: 'glass', godownId: 'gd-1', stock: 10, costPrice: 3200, salePrice: 3800, lowStockThreshold: 5 },
  { id: 'p-01', name: '18mm Marine Plywood', spec: '18mm · Marine · BWR', sku: 'PLY-18MM-MRN', unit: 'sheet', hsnCode: '4412', taxRate: 18, section: 'plywood', godownId: 'gd-1', stock: 4, costPrice: 2800, salePrice: 3200, lowStockThreshold: 10 },
  { id: 'p-02', name: '12mm Commercial Plywood', spec: '12mm · Commercial · MR', sku: 'PLY-12MM-COM', unit: 'sheet', hsnCode: '4412', taxRate: 18, section: 'plywood', godownId: 'gd-1', stock: 24, costPrice: 1800, salePrice: 2100, lowStockThreshold: 10 },
  { id: 'p-03', name: '9mm MDF Board', spec: '9mm · MDF · Plain', sku: 'MDF-09MM', unit: 'sheet', hsnCode: '4411', taxRate: 18, section: 'plywood', godownId: 'gd-4', stock: 18, costPrice: 1400, salePrice: 1650, lowStockThreshold: 8 },
  { id: 'p-04', name: '6mm Plywood', spec: '6mm · Commercial', sku: 'PLY-06MM', unit: 'sheet', hsnCode: '4412', taxRate: 18, section: 'plywood', godownId: 'gd-4', stock: 32, costPrice: 950, salePrice: 1100, lowStockThreshold: 10 },
  { id: 'p-07', name: 'Laminated Sunmica', spec: '1mm · Laminate · Teak/White', sku: 'SHT-SUN-LAM', unit: 'sheet', hsnCode: '4411', taxRate: 18, section: 'plywood', godownId: 'gd-4', stock: 45, costPrice: 380, salePrice: 450, lowStockThreshold: 15 },
  { id: 'p-08', name: 'Veneer Sheets', spec: '0.6mm · Oak Veneer', sku: 'SHT-VENEER', unit: 'sheet', hsnCode: '4408', taxRate: 18, section: 'plywood', godownId: 'gd-4', stock: 28, costPrice: 520, salePrice: 620, lowStockThreshold: 10 },
  { id: 'p-09', name: '2.5" Wood Screws', spec: '2.5" · 100pcs · Zinc Plated', sku: 'HW-SCW-25', unit: 'box', hsnCode: '7318', taxRate: 18, section: 'plywood', godownId: 'gd-3', stock: 85, costPrice: 120, salePrice: 145, lowStockThreshold: 20 },
  { id: 'p-10', name: '3" Drywall Screws', spec: '3" · 100pcs · Zinc Plated', sku: 'HW-SCW-30', unit: 'box', hsnCode: '7318', taxRate: 18, section: 'plywood', godownId: 'gd-3', stock: 62, costPrice: 140, salePrice: 165, lowStockThreshold: 20 },
  { id: 'p-11', name: '4" SS Door Hinges', spec: '4" · SS 304 · Ball Bearing', sku: 'HW-HNG-SS4', unit: 'pair', hsnCode: '8302', taxRate: 18, section: 'plywood', godownId: 'gd-3', stock: 48, costPrice: 180, salePrice: 220, lowStockThreshold: 15 },
  { id: 'p-12', name: 'Cabinet Locks', spec: 'Zinc Die Cast · 25mm', sku: 'HW-LCK-CAB', unit: 'pcs', hsnCode: '8301', taxRate: 18, section: 'plywood', godownId: 'gd-3', stock: 120, costPrice: 95, salePrice: 120, lowStockThreshold: 30 },
  { id: 'p-13', name: 'L-Brackets', spec: '50×50mm · MS · Zinc', sku: 'HW-BRK-L', unit: 'pcs', hsnCode: '8302', taxRate: 18, section: 'plywood', godownId: 'gd-3', stock: 250, costPrice: 25, salePrice: 35, lowStockThreshold: 50 },
  { id: 'p-14', name: '2" Steel Nails', spec: '2" · BW · 500g pack', sku: 'HW-NL-ST2', unit: 'kg', hsnCode: '7317', taxRate: 18, section: 'plywood', godownId: 'gd-3', stock: 18, costPrice: 75, salePrice: 95, lowStockThreshold: 5 },
  { id: 'p-15', name: 'Tower Bolts', spec: '6" · SS 304', sku: 'HW-TBOLT', unit: 'pcs', hsnCode: '8302', taxRate: 18, section: 'plywood', godownId: 'gd-2', stock: 12, costPrice: 85, salePrice: 105, lowStockThreshold: 20 },
  { id: 'p-16', name: '1" PVC Pipe', spec: '1" · Class C · 3m length', sku: 'PLB-PVC-1', unit: 'length', hsnCode: '3917', taxRate: 18, section: 'plumbing', godownId: 'gd-5', stock: 40, costPrice: 120, salePrice: 145, lowStockThreshold: 10 },
  { id: 'p-17', name: '1.5" PVC Pipe', spec: '1.5" · Class C · 3m length', sku: 'PLB-PVC-15', unit: 'length', hsnCode: '3917', taxRate: 18, section: 'plumbing', godownId: 'gd-5', stock: 25, costPrice: 185, salePrice: 220, lowStockThreshold: 8 },
  { id: 'p-18', name: '0.5" CPVC Pipe', spec: '0.5" · SDR-11 · 3m length', sku: 'PLB-CPVC-05', unit: 'length', hsnCode: '3917', taxRate: 18, section: 'plumbing', godownId: 'gd-1', stock: 18, costPrice: 210, salePrice: 255, lowStockThreshold: 6 },
  { id: 'p-19', name: 'PVC Elbow 1"', spec: '1" · 90° · Plain End', sku: 'PLB-ELB-1', unit: 'pcs', hsnCode: '3917', taxRate: 18, section: 'plumbing', godownId: 'gd-3', stock: 180, costPrice: 12, salePrice: 18, lowStockThreshold: 30 },
  { id: 'p-20', name: 'PVC T-Joint 1"', spec: '1" · Equal Tee', sku: 'PLB-TEE-1', unit: 'pcs', hsnCode: '3917', taxRate: 18, section: 'plumbing', godownId: 'gd-3', stock: 150, costPrice: 15, salePrice: 22, lowStockThreshold: 25 },
  { id: 'p-21', name: 'Chrome Bathroom Tap', spec: 'Single Lever · Chrome · ISI', sku: 'PLB-TAP-CHR', unit: 'pcs', hsnCode: '8481', taxRate: 18, section: 'plumbing', godownId: 'gd-1', stock: 5, costPrice: 750, salePrice: 920, lowStockThreshold: 8 },
  { id: 'p-22', name: '1" Ball Valve', spec: '1" · Brass Body · Full Bore', sku: 'PLB-BV-1', unit: 'pcs', hsnCode: '8481', taxRate: 18, section: 'plumbing', godownId: 'gd-1', stock: 32, costPrice: 180, salePrice: 220, lowStockThreshold: 10 },
  { id: 'p-23', name: 'Water Tank Fittings', spec: 'HDPE · 1000L set', sku: 'PLB-TANK-FIT', unit: 'set', hsnCode: '8481', taxRate: 18, section: 'plumbing', godownId: 'gd-5', stock: 14, costPrice: 320, salePrice: 390, lowStockThreshold: 5 },
  { id: 'p-24', name: 'Asian Paints Apex 4L', spec: '4L · Exterior Emulsion', sku: 'PAT-APX-4L', unit: 'tin', hsnCode: '3209', taxRate: 18, section: 'painting', godownId: 'gd-1', stock: 28, costPrice: 1450, salePrice: 1680, lowStockThreshold: 10 },
  { id: 'p-25', name: 'Asian Paints Royale 4L', spec: '4L · Interior Sheen', sku: 'PAT-ROY-4L', unit: 'tin', hsnCode: '3209', taxRate: 18, section: 'painting', godownId: 'gd-1', stock: 8, costPrice: 2200, salePrice: 2550, lowStockThreshold: 15 },
  { id: 'p-26', name: 'White Primer 4L', spec: '4L · Alkyd · White', sku: 'PAT-PRM-4L', unit: 'tin', hsnCode: '3209', taxRate: 18, section: 'painting', godownId: 'gd-1', stock: 35, costPrice: 480, salePrice: 580, lowStockThreshold: 10 },
  { id: 'p-27', name: 'Wall Putty 20kg', spec: '20kg · White Cement Based', sku: 'PAT-PUT-20K', unit: 'bag', hsnCode: '3214', taxRate: 18, section: 'painting', godownId: 'gd-2', stock: 22, costPrice: 520, salePrice: 640, lowStockThreshold: 8 },
  { id: 'p-28', name: '2" Paint Brush', spec: '2" · Natural Bristle', sku: 'PAT-BRS-2', unit: 'pcs', hsnCode: '9603', taxRate: 18, section: 'painting', godownId: 'gd-2', stock: 65, costPrice: 45, salePrice: 60, lowStockThreshold: 20 },
  { id: 'p-29', name: '4" Paint Brush', spec: '4" · Natural Bristle', sku: 'PAT-BRS-4', unit: 'pcs', hsnCode: '9603', taxRate: 18, section: 'painting', godownId: 'gd-2', stock: 42, costPrice: 75, salePrice: 95, lowStockThreshold: 15 },
  { id: 'p-30', name: '9" Paint Roller', spec: '9" · Foam Sleeve + Handle', sku: 'PAT-RLR-9', unit: 'pcs', hsnCode: '3405', taxRate: 18, section: 'painting', godownId: 'gd-5', stock: 18, costPrice: 125, salePrice: 155, lowStockThreshold: 8 },
  { id: 'p-31', name: '80 Grit Sandpaper', spec: '80 Grit · 230×280mm', sku: 'PAT-SND-80', unit: 'sheet', hsnCode: '6805', taxRate: 18, section: 'painting', godownId: 'gd-5', stock: 95, costPrice: 18, salePrice: 25, lowStockThreshold: 25 },
  { id: 'p-32', name: '2.5 sqmm Wire 90m', spec: '2.5mm² · FR · 90m coil', sku: 'ELC-WR-25', unit: 'roll', hsnCode: '8544', taxRate: 18, section: 'electrical', godownId: 'gd-2', stock: 12, costPrice: 1850, salePrice: 2150, lowStockThreshold: 5 },
  { id: 'p-33', name: '4 sqmm Wire 90m', spec: '4mm² · FR · 90m coil', sku: 'ELC-WR-40', unit: 'roll', hsnCode: '8544', taxRate: 18, section: 'electrical', godownId: 'gd-2', stock: 8, costPrice: 2800, salePrice: 3250, lowStockThreshold: 4 },
  { id: 'p-34', name: '6A Modular Switch', spec: '6A · 240V · 1-way', sku: 'ELC-SW-6A', unit: 'pcs', hsnCode: '8536', taxRate: 18, section: 'electrical', godownId: 'gd-2', stock: 185, costPrice: 55, salePrice: 75, lowStockThreshold: 40 },
  { id: 'p-35', name: '16A Modular Socket', spec: '16A · 240V · 3-pin', sku: 'ELC-SK-16A', unit: 'pcs', hsnCode: '8536', taxRate: 18, section: 'electrical', godownId: 'gd-2', stock: 142, costPrice: 90, salePrice: 115, lowStockThreshold: 35 },
  { id: 'p-36', name: '32A MCB', spec: '32A · 240V · Single Pole', sku: 'ELC-MCB-32', unit: 'pcs', hsnCode: '8536', taxRate: 18, section: 'electrical', godownId: 'gd-2', stock: 6, costPrice: 320, salePrice: 390, lowStockThreshold: 10 },
  { id: 'p-37', name: '9W LED Bulb', spec: '9W · E27 · 3000K · 900lm', sku: 'ELC-LED-9W', unit: 'pcs', hsnCode: '8539', taxRate: 12, section: 'electrical', godownId: 'gd-2', stock: 95, costPrice: 75, salePrice: 95, lowStockThreshold: 25 },
  { id: 'p-38', name: '20W Tube Light', spec: '20W · T8 · 4ft · 6500K', sku: 'ELC-TL-20W', unit: 'pcs', hsnCode: '8539', taxRate: 12, section: 'electrical', godownId: 'gd-4', stock: 38, costPrice: 145, salePrice: 185, lowStockThreshold: 12 },
  { id: 'p-39', name: '0.5" Conduit Pipe', spec: '0.5" · PVC · 3m length', sku: 'ELC-CDP-05', unit: 'length', hsnCode: '3917', taxRate: 18, section: 'electrical', godownId: 'gd-4', stock: 55, costPrice: 95, salePrice: 115, lowStockThreshold: 15 },
  { id: 'p-40', name: 'Junction Box', spec: '4×4" · MS · Surface Mount', sku: 'ELC-JB', unit: 'pcs', hsnCode: '8537', taxRate: 18, section: 'electrical', godownId: 'gd-2', stock: 10, costPrice: 45, salePrice: 60, lowStockThreshold: 15 },
]

// ─── Sales bills ─────────────────────────────────────────────────────────────────
const BILLS = [
  { billNumber: 1, date: '2026-04-21T10:15:00.000Z', customerName: 'Rajesh Kumar', customerAddress: '12 Gandhi Nagar, Melpuram', customerPhone: '+91 98765 10001', section: 'glass', bookingDate: '2026-04-20', deliveryDate: '2026-04-25', transport: 'Own vehicle', transportTime: '10 AM', subtotal: 11600, total: 11600, discount: 200, paidAmount: 10000, status: 'partial', createdBy: 'u-1',
    items: [
      { productId: 'p-01', productName: '18mm Marine Plywood', quantity: 2, unit: 'sheet', glassSize: '8×4 ft', model: 'BWR', sqFt: 64, unitPrice: 100, subtotal: 6400 },
      { productId: 'p-05', productName: '8mm Toughened Glass', quantity: 1, unit: 'sheet', glassSize: '4×3 ft', model: 'Clear', sqFt: 13, unitPrice: 400, subtotal: 5200 },
    ] },
  { billNumber: 2, date: '2026-04-23T14:30:00.000Z', customerName: 'Suresh Nair', customerPhone: '+91 94432 20002', section: 'plywood', subtotal: 1605, total: 1605, discount: 0, paidAmount: 1605, status: 'paid', createdBy: 'u-1',
    items: [
      { productId: 'p-09', productName: '2.5" Wood Screws', quantity: 5, unit: 'box', unitPrice: 145, subtotal: 725 },
      { productId: 'p-11', productName: '4" SS Door Hinges', quantity: 4, unit: 'pair', unitPrice: 220, subtotal: 880 },
    ] },
  { billNumber: 3, date: '2026-04-26T09:00:00.000Z', customerName: 'Priya Menon', customerPhone: '+91 87654 30003', section: 'plumbing', subtotal: 1810, total: 1810, discount: 0, paidAmount: 1500, status: 'partial', createdBy: 'u-2',
    items: [
      { productId: 'p-16', productName: '1" PVC Pipe', quantity: 10, unit: 'length', unitPrice: 145, subtotal: 1450 },
      { productId: 'p-19', productName: 'PVC Elbow 1"', quantity: 20, unit: 'pcs', unitPrice: 18, subtotal: 360 },
    ] },
  { billNumber: 4, date: '2026-04-29T11:20:00.000Z', customerName: 'Anand Krishnan', customerPhone: '+91 90000 40004', section: 'painting', subtotal: 6200, total: 6200, discount: 100, paidAmount: 6100, status: 'paid', createdBy: 'u-2',
    items: [
      { productId: 'p-24', productName: 'Asian Paints Apex 4L', quantity: 3, unit: 'tin', unitPrice: 1680, subtotal: 5040 },
      { productId: 'p-26', productName: 'White Primer 4L', quantity: 2, unit: 'tin', unitPrice: 580, subtotal: 1160 },
    ] },
  { billNumber: 5, date: '2026-05-02T15:45:00.000Z', customerPhone: '+91 99887 50005', section: 'glass', bookingDate: '2026-05-01', deliveryDate: '2026-05-05', subtotal: 17100, total: 17100, discount: 0, paidAmount: 15000, status: 'partial', createdBy: 'u-1',
    items: [
      { productId: 'p-02', productName: '12mm Commercial Plywood', quantity: 6, unit: 'sheet', glassSize: '7×4 ft', model: 'MR', sqFt: 126, unitPrice: 100, subtotal: 12600 },
      { productId: 'p-07', productName: 'Laminated Sunmica', quantity: 10, unit: 'sheet', glassSize: '9×2 ft', model: 'Teak', sqFt: 90, unitPrice: 50, subtotal: 4500 },
    ] },
  { billNumber: 6, date: '2026-05-06T10:00:00.000Z', customerName: 'Deepa Raman', customerPhone: '+91 96543 60006', section: 'electrical', subtotal: 4075, total: 4075, discount: 0, paidAmount: 4075, status: 'paid', createdBy: 'u-2',
    items: [
      { productId: 'p-34', productName: '6A Modular Switch', quantity: 20, unit: 'pcs', unitPrice: 75, subtotal: 1500 },
      { productId: 'p-35', productName: '16A Modular Socket', quantity: 10, unit: 'pcs', unitPrice: 115, subtotal: 1150 },
      { productId: 'p-37', productName: '9W LED Bulb', quantity: 15, unit: 'pcs', unitPrice: 95, subtotal: 1425 },
    ] },
  { billNumber: 7, date: '2026-05-09T13:15:00.000Z', customerName: 'Balaji Iyer', customerPhone: '+91 88776 70007', section: 'plywood', subtotal: 2490, total: 2490, discount: 90, paidAmount: 2000, status: 'partial', createdBy: 'u-1',
    items: [
      { productId: 'p-12', productName: 'Cabinet Locks', quantity: 12, unit: 'pcs', unitPrice: 120, subtotal: 1440 },
      { productId: 'p-13', productName: 'L-Brackets', quantity: 30, unit: 'pcs', unitPrice: 35, subtotal: 1050 },
    ] },
  { billNumber: 8, date: '2026-05-14T09:30:00.000Z', customerName: 'Kavitha Sundaram', customerPhone: '+91 91234 80008', section: 'plumbing', subtotal: 1660, total: 1660, discount: 0, paidAmount: 1660, status: 'paid', createdBy: 'u-2',
    items: [
      { productId: 'p-22', productName: '1" Ball Valve', quantity: 4, unit: 'pcs', unitPrice: 220, subtotal: 880 },
      { productId: 'p-23', productName: 'Water Tank Fittings', quantity: 2, unit: 'set', unitPrice: 390, subtotal: 780 },
    ] },
  { billNumber: 9, date: '2026-05-17T14:00:00.000Z', customerName: 'Murugan P.', customerAddress: '45 Lake View, Thoothukudi', customerPhone: '+91 77665 90009', section: 'glass', bookingDate: '2026-05-16', deliveryDate: '2026-05-20', transport: 'Lorry', transportTime: '2 PM', subtotal: 13210, total: 13210, discount: 210, paidAmount: 7000, status: 'partial', createdBy: 'u-1',
    items: [
      { productId: 'p-03', productName: '9mm MDF Board', quantity: 5, unit: 'sheet', glassSize: '8×3 ft', model: 'Plain', sqFt: 75, unitPrice: 110, subtotal: 8250 },
      { productId: 'p-08', productName: 'Veneer Sheets', quantity: 8, unit: 'sheet', glassSize: '4×2.5 ft', model: 'Oak', sqFt: 80, unitPrice: 62, subtotal: 4960 },
    ] },
  { billNumber: 10, date: '2026-05-19T11:45:00.000Z', customerName: 'Saranya V.', customerPhone: '+91 82345 00010', section: 'painting', subtotal: 7320, total: 7320, discount: 20, paidAmount: 7300, status: 'paid', createdBy: 'u-2',
    items: [
      { productId: 'p-25', productName: 'Asian Paints Royale 4L', quantity: 2, unit: 'tin', unitPrice: 2550, subtotal: 5100 },
      { productId: 'p-27', productName: 'Wall Putty 20kg', quantity: 3, unit: 'bag', unitPrice: 640, subtotal: 1920 },
      { productId: 'p-28', productName: '2" Paint Brush', quantity: 5, unit: 'pcs', unitPrice: 60, subtotal: 300 },
    ] },
]

// ─── Purchase bills ──────────────────────────────────────────────────────────────
const PURCHASES = [
  { voucherNumber: 'PUR-2026-0001', vendorName: 'Sri Balaji Plywoods', date: '2026-05-03T10:20:00.000Z', section: 'glass', godownId: 'gd-1', subtotal: 18720, total: 18720, createdBy: 'u-1', printedAt: '2026-05-03T10:45:00.000Z',
    items: [
      { productId: 'p-02', productName: '12mm Commercial Plywood', quantity: 8, unit: 'sheet', unitPrice: 1725, subtotal: 13800 },
      { productId: '', productName: 'Designer Laminate Sheet', quantity: 12, unit: 'sheet', unitPrice: 410, subtotal: 4920 },
    ] },
  { voucherNumber: 'PUR-2026-0002', vendorName: 'Metro Hardware Supply', date: '2026-05-08T12:10:00.000Z', section: 'plywood', godownId: 'gd-3', subtotal: 4440, total: 4440, createdBy: 'u-1', printedAt: '2026-05-08T12:28:00.000Z',
    items: [
      { productId: 'p-09', productName: '2.5" Wood Screws', quantity: 20, unit: 'box', unitPrice: 112, subtotal: 2240 },
      { productId: 'p-13', productName: 'L-Brackets', quantity: 100, unit: 'pcs', unitPrice: 22, subtotal: 2200 },
    ] },
  { voucherNumber: 'PUR-2026-0003', vendorName: 'Kaveri Plumbing Traders', date: '2026-05-11T09:30:00.000Z', section: 'plumbing', godownId: 'gd-5', subtotal: 3520, total: 3520, createdBy: 'u-2', printedAt: '2026-05-11T09:55:00.000Z',
    items: [
      { productId: 'p-16', productName: '1" PVC Pipe', quantity: 25, unit: 'length', unitPrice: 112, subtotal: 2800 },
      { productId: '', productName: 'PVC Coupler 1"', quantity: 80, unit: 'pcs', unitPrice: 9, subtotal: 720 },
    ] },
  { voucherNumber: 'PUR-2026-0004', vendorName: 'Bright Paint Depot', date: '2026-05-18T15:05:00.000Z', section: 'painting', godownId: 'gd-2', subtotal: 7500, total: 7500, createdBy: 'u-2', printedAt: null,
    items: [
      { productId: 'p-27', productName: 'Wall Putty 20kg', quantity: 15, unit: 'bag', unitPrice: 500, subtotal: 7500 },
    ] },
  { voucherNumber: 'PUR-2026-0005', vendorName: 'South Star Electricals', date: '2026-05-19T11:40:00.000Z', section: 'electrical', godownId: 'gd-4', subtotal: 4068, total: 4068, createdBy: 'u-2', printedAt: null,
    items: [
      { productId: 'p-38', productName: '20W Tube Light', quantity: 24, unit: 'pcs', unitPrice: 132, subtotal: 3168 },
      { productId: '', productName: 'Ceiling Rose', quantity: 50, unit: 'pcs', unitPrice: 18, subtotal: 900 },
    ] },
]

async function main() {
  console.log('🌱 Seeding database…')

  // Clear in child → parent order so FK constraints are satisfied.
  await prisma.salesItem.deleteMany()
  await prisma.purchaseItem.deleteMany()
  await prisma.salesBill.deleteMany()
  await prisma.purchaseBill.deleteMany()
  await prisma.transferLog.deleteMany()
  await prisma.product.deleteMany()
  await prisma.godown.deleteMany()
  await prisma.user.deleteMany()

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const counterHash = await bcrypt.hash(COUNTER_PASSWORD, 10)

  await prisma.godown.createMany({ data: GODOWNS })

  await prisma.user.create({
    data: {
      id: 'u-3',
      name: 'Subramaniam V.',
      email: 'subbu@hardwareco.in',
      passwordHash: adminHash,
      role: 'admin',
      active: true,
      sortOrder: 0,
      processes: ['glass', 'plywood', 'plumbing', 'painting', 'electrical'],
    },
  })

  for (const [index, c] of COUNTERS.entries()) {
    await prisma.user.create({
      data: {
        id: c.id,
        name: c.name,
        email: `${c.id}@hardwareco.local`,
        passwordHash: counterHash,
        role: c.id,
        label: c.label,
        initials: c.initials,
        avatarColor: c.avatarColor,
        active: true,
        sortOrder: index + 1,
        processes: c.process.map((p) => SECTION_BY_TYPE[p]),
      },
    })
  }

  await prisma.product.createMany({
    data: PRODUCTS.map((p) => ({ ...p, section: p.section as Section })),
  })

  for (const bill of BILLS) {
    const { items, ...rest } = bill
    await prisma.salesBill.create({
      data: {
        ...rest,
        section: rest.section as Section,
        status: rest.status as 'paid' | 'pending' | 'partial',
        date: new Date(rest.date),
        createdAt: new Date(rest.date),
        items: { create: items },
      },
    })
  }

  for (const purchase of PURCHASES) {
    const { items, ...rest } = purchase
    await prisma.purchaseBill.create({
      data: {
        ...rest,
        section: rest.section as Section,
        date: new Date(rest.date),
        createdAt: new Date(rest.date),
        printedAt: rest.printedAt ? new Date(rest.printedAt) : null,
        items: { create: items },
      },
    })
  }

  console.log(`✓ ${GODOWNS.length} godowns, ${PRODUCTS.length} products, ${COUNTERS.length + 1} users`)
  console.log(`✓ ${BILLS.length} sales bills, ${PURCHASES.length} purchases`)
  console.log(`\nLogin passwords → admin: "${ADMIN_PASSWORD}"  |  counters: "${COUNTER_PASSWORD}"`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
