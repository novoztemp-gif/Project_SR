import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { WeeklyRevenueDay } from '@/lib/reportSelectors'

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const DAY_COLORS = ['#4A90D9', '#E8844A', '#2EAF7D', '#E8C84A', '#7B5EA7', '#E85A7A', '#50C878']

function axisMoney(value: number) {
  return `₹${Math.round(value / 1000)}k`
}

function WeeklyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value?: number; payload?: Pick<WeeklyRevenueDay, 'label' | 'revenue' | 'isToday'> & { color?: string; date?: Date } }>
}) {
  const row = payload?.[0]?.payload
  if (!active || !payload?.length || !row) return null
  const dayName = row.date
    ? new Date(row.date).toLocaleDateString('en-IN', { weekday: 'long' })
    : row.label

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
        <p className="text-xs font-medium">{dayName}</p>
      </div>
      <p className="mt-1 font-mono text-sm tabular-nums">{INR.format(Number(payload[0].value ?? 0))}</p>
    </div>
  )
}

export function WeeklyBarChart({ days }: { days: (Pick<WeeklyRevenueDay, 'label' | 'revenue' | 'isToday'> & { date?: Date })[] }) {
  const data = days.map((day, index) => ({ ...day, color: DAY_COLORS[index % DAY_COLORS.length] }))

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={axisMoney}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            width={48}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} content={<WeeklyTooltip />} />
          <Bar
            dataKey="revenue"
            radius={[6, 6, 0, 0]}
            activeBar={{ opacity: 0.75 }}
            isAnimationActive={false}
          >
            {data.map((day, index) => (
              <Cell key={`${day.label}-${index}`} fill={day.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
