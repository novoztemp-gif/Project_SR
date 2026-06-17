import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Toaster } from 'sonner'

import { useAuthStore } from '@/store/authStore'

import { AppShell } from '@/components/layout/AppShell'
import { CounterManagementPage } from '@/pages/admin/CounterManagementPage'
import { BillDetailPage } from '@/pages/billing/BillDetailPage'
import { BillHistoryPage } from '@/pages/billing/BillHistoryPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { GodownsPage } from '@/pages/inventory/GodownsPage'
import { ProductsPage } from '@/pages/inventory/ProductsPage'
import { TransferLogPage } from '@/pages/inventory/TransferLogPage'
import { LoginPage } from '@/pages/LoginPage'
import { NewBillPage } from '@/pages/billing/NewBillPage'
import { NewPurchasePage } from '@/pages/purchases/NewPurchasePage'
import { PurchaseDetailPage } from '@/pages/purchases/PurchaseDetailPage'
import { PurchaseListPage } from '@/pages/purchases/PurchaseListPage'
import { DailyReportPage } from '@/pages/reports/DailyReportPage'
import { MonthlyReportPage } from '@/pages/reports/MonthlyReportPage'
import { WeeklyReportPage } from '@/pages/reports/WeeklyReportPage'
import { YearlyReportPage } from '@/pages/reports/YearlyReportPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
// ─── Placeholder for unbuilt pages ────────────────────────────────────────────

export function PlaceholderPage({ name }: { name: string }) {
  return (
    <p className="font-mono text-sm text-muted-foreground">
      {name} — coming soon
    </p>
  )
}

function LegacyPurchaseDetailRedirect() {
  const { id } = useParams()
  return <Navigate to={`/purchases/${id ?? ''}`} replace />
}

/** Validates a persisted session before the routes mount. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (status !== 'ready') {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting up…
      </div>
    )
  }
  return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <BrowserRouter>
        <AuthGate>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"          element={<DashboardPage />} />
              <Route path="/billing"            element={<BillHistoryPage />} />

              <Route element={<ProtectedRoute allowedRoles={['billing_', 'admin']} />}>
                <Route path="/billing/new" element={<NewBillPage />} />
              </Route>
              <Route path="/billing/:id"        element={<BillDetailPage />} />
              <Route path="/purchase"           element={<Navigate to="/purchases" replace />} />
              <Route path="/purchase/new"       element={<Navigate to="/purchases/new" replace />} />
              <Route path="/purchase/:id"       element={<LegacyPurchaseDetailRedirect />} />
              <Route path="/purchases"          element={<PurchaseListPage />} />
              <Route path="/purchases/new"      element={<NewPurchasePage />} />
              <Route path="/purchases/:id"      element={<PurchaseDetailPage />} />
              <Route path="/inventory"          element={<InventoryPage />} />
              <Route path="/inventory/products" element={<ProductsPage />} />
              <Route path="/inventory/godowns"  element={<GodownsPage />} />
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin/counters" element={<CounterManagementPage />} />
                <Route path="/inventory/transfers" element={<TransferLogPage />} />
              </Route>

              <Route path="/reports"       element={<Navigate to="/reports/daily" replace />} />
              <Route path="/reports/daily" element={<DailyReportPage />} />

              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/reports/yearly" element={<YearlyReportPage />} />
              </Route>
              <Route path="/reports/weekly"  element={<WeeklyReportPage />} />
              <Route path="/reports/monthly" element={<MonthlyReportPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </AuthGate>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </>
  )
}
