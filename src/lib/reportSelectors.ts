import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  startOfMonth,
  subDays,
} from 'date-fns'

import { SECTIONS } from '@/lib/constants'
import { getUserSections } from '@/lib/userSections'
import type { SalesBill, Section, User } from '@/types'

export interface WeeklyRevenueDay {
  date: Date
  label: string
  billCount: number
  revenue: number
  isToday: boolean
}

export interface SectionBreakdownRow {
  section: Section
  sectionLabel: string
  billCount: number
  revenue: number
  percentOfTotal: number
  collectionRate: number
}

export interface StatusBreakdownRow {
  status: 'paid' | 'partial' | 'pending'
  billCount: number
  amount: number
}

export interface YearlyMonthRow {
  month: string
  monthName: string
  monthIndex: number
  billCount: number
  revenue: number
  avgBillValue: number
  growthPct: number | null
}

export interface YearlySectionRow extends SectionBreakdownRow {
  barPct: number
}

export interface YearlyReportData {
  year: number
  months: YearlyMonthRow[]
  totalRevenue: number
  totalBills: number
  avgMonthlyRevenue: number
  bestMonth: YearlyMonthRow
  sectionBreakdown: YearlySectionRow[]
}

export function safeMoney(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export function getBillFinalAmount(bill: SalesBill): number {
  // Must match the backend's authoritative formula (server/src/lib/billing.ts
  // getBillStatus) and every other place this is computed (PrintableBill,
  // NewBillPage) — omitting transportationAmount here understated revenue
  // and could misclassify a fully-paid bill with a transport charge as
  // partial/pending in every report that builds on this function.
  return Math.max(0, safeMoney(bill.total) + safeMoney(bill.transportationAmount) - safeMoney(bill.discount))
}

export function getBillPaidAmount(bill: SalesBill): number {
  return Math.min(getBillFinalAmount(bill), Math.max(0, safeMoney(bill.paidAmount)))
}

export function getBillPendingAmount(bill: SalesBill): number {
  return Math.max(0, getBillFinalAmount(bill) - getBillPaidAmount(bill))
}

export function getBillSqFt(bill: SalesBill): number {
  return bill.items.reduce((sum, item) => sum + safeMoney(item.sqFt), 0)
}

export function getBillStatus(bill: SalesBill): 'paid' | 'partial' | 'pending' {
  const finalAmount = getBillFinalAmount(bill)
  const paidAmount = getBillPaidAmount(bill)
  if (paidAmount >= finalAmount) return 'paid'
  if (paidAmount > 0) return 'partial'
  return 'pending'
}

export function selectBillsForDate(bills: SalesBill[], date: Date): SalesBill[] {
  return bills.filter((bill) => isSameDay(new Date(bill.date), date))
}

export function selectBillsForMonth(bills: SalesBill[], monthDate: Date): SalesBill[] {
  return bills.filter((bill) => isSameMonth(new Date(bill.date), monthDate))
}

export function scopeBillsForUser(bills: SalesBill[], user: User): SalesBill[] {
  const allowedSections = getUserSections(user.id)
  return bills.filter((bill) => {
    const sectionAllowed = allowedSections.includes(bill.section)
    if (user.role === 'admin') return sectionAllowed
    return sectionAllowed && bill.createdBy === user.id
  })
}

export function selectDayTotals(bills: SalesBill[]) {
  return {
    billCount: bills.length,
    sqFt: bills.reduce((sum, bill) => sum + getBillSqFt(bill), 0),
    revenue: bills.reduce((sum, bill) => sum + getBillFinalAmount(bill), 0),
  }
}

export function selectWeeklyRevenue(
  bills: SalesBill[],
  referenceDate = new Date(),
): WeeklyRevenueDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(referenceDate, 6 - index)
    const dayBills = selectBillsForDate(bills, date)
    return {
      date,
      label: format(date, 'EEE'),
      billCount: dayBills.length,
      revenue: dayBills.reduce((sum, bill) => sum + getBillFinalAmount(bill), 0),
      isToday: isSameDay(date, referenceDate),
    }
  })
}

export function selectSectionBreakdown(bills: SalesBill[]): SectionBreakdownRow[] {
  const totalRevenue = bills.reduce((sum, bill) => sum + getBillFinalAmount(bill), 0)

  return SECTIONS.map((sectionMeta) => {
    const sectionBills = bills.filter((bill) => bill.section === sectionMeta.key)
    const revenue = sectionBills.reduce((sum, bill) => sum + getBillFinalAmount(bill), 0)
    const paid = sectionBills.reduce((sum, bill) => sum + getBillPaidAmount(bill), 0)
    return {
      section: sectionMeta.key,
      sectionLabel: sectionMeta.label,
      billCount: sectionBills.length,
      revenue,
      percentOfTotal: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      collectionRate: revenue > 0 ? (paid / revenue) * 100 : 0,
    }
  }).filter((row) => row.billCount > 0 || row.revenue > 0)
}

export function selectCollectionStats(bills: SalesBill[]) {
  const total = bills.reduce((sum, bill) => sum + getBillFinalAmount(bill), 0)
  const paid = bills.reduce((sum, bill) => sum + getBillPaidAmount(bill), 0)
  const pending = bills.reduce((sum, bill) => sum + getBillPendingAmount(bill), 0)
  return {
    total,
    paid,
    pending,
    collectionRate: total > 0 ? (paid / total) * 100 : 0,
  }
}

export function selectFulfilmentStats(bills: SalesBill[]) {
  const fulfilled = bills.filter((bill) => getBillStatus(bill) === 'paid').length
  return {
    totalBills: bills.length,
    fulfilledBills: fulfilled,
    pendingBills: bills.length - fulfilled,
    fulfilmentRate: bills.length > 0 ? (fulfilled / bills.length) * 100 : 0,
  }
}

export function selectStatusBreakdown(bills: SalesBill[]): StatusBreakdownRow[] {
  const statuses: StatusBreakdownRow['status'][] = ['paid', 'partial', 'pending']
  return statuses.map((status) => {
    const statusBills = bills.filter((bill) => getBillStatus(bill) === status)
    return {
      status,
      billCount: statusBills.length,
      amount: statusBills.reduce((sum, bill) => sum + getBillFinalAmount(bill), 0),
    }
  })
}

export function selectCurrentMonthBills(bills: SalesBill[], referenceDate = new Date()) {
  const start = startOfMonth(referenceDate)
  const end = endOfMonth(referenceDate)
  return bills.filter((bill) => {
    const date = new Date(bill.date)
    return date >= start && date <= end
  })
}

export function selectMonthDays(monthDate: Date): Date[] {
  return eachDayOfInterval({
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate),
  })
}

function billYearDate(bill: SalesBill) {
  return new Date(bill.createdAt || bill.date)
}

export function getYearlyData(bills: SalesBill[], year: number): YearlyReportData {
  const months = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthBills = bills.filter((bill) => {
      const date = billYearDate(bill)
      return getYear(date) === year && getMonth(date) === monthIndex
    })
    const revenue = monthBills.reduce((sum, bill) => sum + getBillFinalAmount(bill), 0)

    return {
      month: format(new Date(year, monthIndex, 1), 'MMM'),
      monthName: format(new Date(year, monthIndex, 1), 'MMMM'),
      monthIndex,
      billCount: monthBills.length,
      revenue,
      avgBillValue: monthBills.length > 0 ? revenue / monthBills.length : 0,
      growthPct: null,
    }
  })

  const monthsWithGrowth = months.map((month, index) => {
    if (index === 0) return month
    const previousRevenue = months[index - 1].revenue
    if (previousRevenue === 0) return { ...month, growthPct: month.revenue > 0 ? 100 : 0 }
    return { ...month, growthPct: ((month.revenue - previousRevenue) / previousRevenue) * 100 }
  })

  const yearBills = bills.filter((bill) => getYear(billYearDate(bill)) === year)
  const totalRevenue = monthsWithGrowth.reduce((sum, month) => sum + month.revenue, 0)
  const bestMonth = monthsWithGrowth.reduce((best, month) => month.revenue > best.revenue ? month : best, monthsWithGrowth[0])
  const sectionBreakdown = selectSectionBreakdown(yearBills).map((row) => ({
    ...row,
    barPct: totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0,
  }))

  return {
    year,
    months: monthsWithGrowth,
    totalRevenue,
    totalBills: yearBills.length,
    avgMonthlyRevenue: totalRevenue / 12,
    bestMonth,
    sectionBreakdown,
  }
}
