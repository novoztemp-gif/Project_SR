import { Download } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { WeeklyBarChart } from '@/components/reports/WeeklyBarChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { exportCsv } from '@/lib/exportCsv'
import { scopeBillsForUser, selectSectionBreakdown, selectWeeklyRevenue } from '@/lib/reportSelectors'
import { useAuthStore } from '@/store/authStore'
import { useBillingStore } from '@/store/billingStore'

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function WeeklyReportPage() {
  const currentUser = useAuthStore((state) => state.currentUser)!
  const allBills = useBillingStore((state) => state.bills)
  const bills = scopeBillsForUser(allBills, currentUser)
  const weekDays = selectWeeklyRevenue(bills)
  const weeklyTotal = weekDays.reduce((sum, day) => sum + day.revenue, 0)
  const avgPerDay = weeklyTotal / 7
  const sectionBreakdown = selectSectionBreakdown(
    bills.filter((bill) => weekDays.some((day) => format(day.date, 'yyyy-MM-dd') === format(new Date(bill.date), 'yyyy-MM-dd'))),
  )

  function exportWeeklyCsv() {
    exportCsv(
      `weekly-report-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Date', 'Bill Count', 'Revenue'],
      [
        ...weekDays.map((day) => [format(day.date, 'yyyy-MM-dd'), day.billCount, day.revenue]),
        ['TOTAL', weekDays.reduce((sum, day) => sum + day.billCount, 0), weeklyTotal],
      ],
    )
    toast.success('Weekly report exported')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium">Weekly Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last 7 days</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={exportWeeklyCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Weekly total</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{INR.format(weeklyTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Avg / day</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{INR.format(Math.round(avgPerDay))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Bill count</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
              {weekDays.reduce((sum, day) => sum + day.billCount, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border bg-card">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-base">Weekly Revenue</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <WeeklyBarChart days={weekDays} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Per-Day Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead className="text-right">Bill count</TableHead>
                  <TableHead className="pr-6 text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekDays.map((day) => (
                  <TableRow key={day.date.toISOString()}>
                    <TableCell className="pl-6">{format(day.date, 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{day.billCount}</TableCell>
                    <TableCell className="pr-6 text-right font-mono tabular-nums">{INR.format(day.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Section Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Section</TableHead>
                  <TableHead className="text-right">Bills</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="pr-6 text-right">% of total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionBreakdown.map((row) => (
                  <TableRow key={row.section}>
                    <TableCell className="pl-6">{row.sectionLabel}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.billCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{INR.format(row.revenue)}</TableCell>
                    <TableCell className="pr-6 text-right font-mono tabular-nums">{Math.round(row.percentOfTotal)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator className="mt-1" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
