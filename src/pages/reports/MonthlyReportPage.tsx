import { Download } from 'lucide-react'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SECTION_COLORS, SECTIONS } from '@/lib/constants'
import { exportCsv } from '@/lib/exportCsv'
import {
  selectBillsForMonth,
  selectCollectionStats,
  selectFulfilmentStats,
  selectSectionBreakdown,
  selectStatusBreakdown,
} from '@/lib/reportSelectors'
import { getUserName, getUserSections } from '@/lib/userSections'
import { useAuthStore } from '@/store/authStore'
import { useBillingStore } from '@/store/billingStore'

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function monthFromValue(value: string) {
  return new Date(`${value}-01T00:00:00`)
}

function axisMoney(value: number) {
  return `₹${Math.round(value / 1000)}k`
}

const STATUS_COLORS = {
  paid: '#4CAF50',
  partial: '#FFB74D',
  pending: '#EF5350',
} as const

interface SectionChartRow {
  section: string
  sectionLabel: string
  billCount: number
  revenue: number
  percentOfTotal: number
  collectionRate: number
}

interface StatusChartRow {
  status: 'paid' | 'partial' | 'pending'
  billCount: number
  amount: number
}

interface UserChartRow {
  userId: string
  name: string
  billCount: number
  revenue: number
  collected: number
  pending: number
  collectionRate: number
  fulfilmentRate: number
}

function UserTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: UserChartRow }>
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{row.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{row.billCount} bill{row.billCount === 1 ? '' : 's'}</p>
      <p className="font-mono text-sm tabular-nums">{INR.format(row.revenue)}</p>
    </div>
  )
}

function SectionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: SectionChartRow }>
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{row.sectionLabel}</p>
      <p className="mt-1 text-xs text-muted-foreground">{row.billCount} bill{row.billCount === 1 ? '' : 's'}</p>
      <p className="font-mono text-sm tabular-nums">{INR.format(row.revenue)}</p>
    </div>
  )
}

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: StatusChartRow }>
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium capitalize">{row.status}</p>
      <p className="mt-1 text-xs text-muted-foreground">{row.billCount} bill{row.billCount === 1 ? '' : 's'}</p>
      <p className="font-mono text-sm tabular-nums">{INR.format(row.amount)}</p>
    </div>
  )
}

export function MonthlyReportPage() {
  const navigate = useNavigate()
  const bills = useBillingStore((state) => state.bills)
  const currentUser = useAuthStore((state) => state.currentUser)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const isBillingUser = currentUser?.role.startsWith('billing_') ?? false
  const monthDate = monthFromValue(selectedMonth)
  const accessibleSections = currentUser
    ? getUserSections(currentUser.id)
    : SECTIONS.map((section) => section.key)
  const monthBills = selectBillsForMonth(bills, monthDate).filter((bill) => accessibleSections.includes(bill.section))
  const collection = selectCollectionStats(monthBills)
  const fulfilment = selectFulfilmentStats(monthBills)
  const sectionBreakdown = selectSectionBreakdown(monthBills)
  const statusBreakdown = selectStatusBreakdown(monthBills)
  const sectionChartData: SectionChartRow[] = SECTIONS.filter((section) => accessibleSections.includes(section.key)).map((section) => {
    const row = sectionBreakdown.find((item) => item.section === section.key)
    return {
      section: section.key,
      sectionLabel: section.label,
      billCount: row?.billCount ?? 0,
      revenue: row?.revenue ?? 0,
      percentOfTotal: row?.percentOfTotal ?? 0,
      collectionRate: row?.collectionRate ?? 0,
    }
  })

  // Per-staff comparison — built from whoever actually created a bill this
  // month, not a fixed roster, so it still covers a since-deactivated
  // counter's historical activity rather than silently dropping it.
  const userChartData: UserChartRow[] = Array.from(new Set(monthBills.map((bill) => bill.createdBy)))
    .map((userId) => {
      const userBills = monthBills.filter((bill) => bill.createdBy === userId)
      const userCollection = selectCollectionStats(userBills)
      const userFulfilment = selectFulfilmentStats(userBills)
      return {
        userId,
        name: getUserName(userId),
        billCount: userBills.length,
        revenue: userCollection.total,
        collected: userCollection.paid,
        pending: userCollection.pending,
        collectionRate: userCollection.collectionRate,
        fulfilmentRate: userFulfilment.fulfilmentRate,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  useEffect(() => {
    if (!isBillingUser) return
    toast.error('Access denied')
    navigate('/dashboard', { replace: true })
  }, [isBillingUser, navigate])

  if (isBillingUser) return null

  function exportMonthlyCsv() {
    exportCsv(
      `monthly-report-${selectedMonth}.csv`,
      ['Section', 'Bills', 'Revenue', 'Collection Rate'],
      [
        ...sectionChartData.map((row) => [
          row.sectionLabel,
          row.billCount,
          row.revenue,
          `${Math.round(row.collectionRate)}%`,
        ]),
        ['TOTAL', monthBills.length, collection.total, `${Math.round(collection.collectionRate)}%`],
      ],
    )
    toast.success('Monthly report exported')
  }

  function exportUserCsv() {
    exportCsv(
      `monthly-report-by-user-${selectedMonth}.csv`,
      ['Staff', 'Bills', 'Revenue', 'Collected', 'Pending', 'Collection Rate', 'Fulfilment Rate'],
      userChartData.map((row) => [
        row.name,
        row.billCount,
        row.revenue,
        row.collected,
        row.pending,
        `${Math.round(row.collectionRate)}%`,
        `${Math.round(row.fulfilmentRate)}%`,
      ]),
    )
    toast.success('Per-staff report exported')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium">Monthly Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">{format(monthDate, 'MMMM yyyy')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value || format(new Date(), 'yyyy-MM'))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Report month"
          />
          <Button type="button" variant="outline" size="sm" onClick={exportMonthlyCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Revenue</p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{INR.format(collection.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Bill count</p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{monthBills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Collection</p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{Math.round(collection.collectionRate)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Fulfilment</p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{Math.round(fulfilment.fulfilmentRate)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pending</p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{INR.format(collection.pending)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border border-border bg-card">
          <CardContent className="space-y-5 p-5">
            <h2 className="text-base font-medium">Section Breakdown</h2>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="sectionLabel" axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis tickFormatter={axisMoney} axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} width={48} />
                  <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} content={<SectionTooltip />} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={600}>
                    {sectionChartData.map((row) => (
                      <Cell key={row.section} fill={SECTION_COLORS[row.sectionLabel]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Bills</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">% of total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionChartData.map((row) => (
                  <TableRow key={row.section}>
                    <TableCell>{row.sectionLabel}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.billCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{INR.format(row.revenue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{Math.round(row.percentOfTotal)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card">
          <CardContent className="space-y-5 p-5">
            <h2 className="text-base font-medium">Status Breakdown</h2>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<StatusTooltip />} />
                  <Pie
                    data={statusBreakdown}
                    dataKey="amount"
                    nameKey="status"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    isAnimationActive
                    animationDuration={600}
                  >
                    {statusBreakdown.map((row) => (
                      <Cell key={row.status} fill={STATUS_COLORS[row.status]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {statusBreakdown.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[row.status] }} />
                    <span className="capitalize">{row.status}</span>
                    <span className="text-muted-foreground">{row.billCount} bill{row.billCount === 1 ? '' : 's'}</span>
                  </div>
                  <span className="font-mono tabular-nums">{INR.format(row.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border bg-card">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-medium">By Staff — compare performance</h2>
            <Button type="button" variant="outline" size="sm" onClick={exportUserCsv} disabled={userChartData.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          {userChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills this month yet.</p>
          ) : (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis tickFormatter={axisMoney} axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} width={48} />
                    <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} content={<UserTooltip />} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#5F9598" isAnimationActive animationDuration={600} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Collection</TableHead>
                    <TableHead className="text-right">Fulfilment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userChartData.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{row.billCount}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{INR.format(row.revenue)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{INR.format(row.collected)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{INR.format(row.pending)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{Math.round(row.collectionRate)}%</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{Math.round(row.fulfilmentRate)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
