import { useState } from 'react'
import { AlertTriangle, Eraser } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'

export function ResetDataPage() {
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ bills: number; purchases: number; transfers: number; products: number } | null>(null)

  async function confirmReset() {
    setBusy(true)
    try {
      const deleted = await api.admin.resetAllData()
      setDone(deleted)
      setConfirmOpen(false)
      setAcknowledged(false)
      toast.success('All data cleared')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear data')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-heading flex items-center gap-2">
          <Eraser className="h-5 w-5" />
          Reset Data
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wipe every bill and product so the app looks freshly installed, ready for new data.
        </p>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-5 w-5" />
            This is permanent — read before continuing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-foreground">This permanently deletes:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
              <li>Every bill — general, Glass &amp; Plywood, and purchases</li>
              <li>Every product and its stock</li>
              <li>The godown transfer log</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">This does NOT touch:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
              <li>Godowns — kept as-is, ready to receive new stock</li>
              <li>Counter accounts and admin logins — nobody needs to be recreated</li>
            </ul>
          </div>
          <p className="text-muted-foreground">
            Every dashboard, report, and analytics figure is calculated from bills/purchases, so they'll all read zero
            immediately afterward — there's nothing further to reset there.
          </p>
          <p className="font-medium text-destructive">
            There is no undo. Once this runs, the deleted bills and products cannot be recovered.
          </p>

          <label className="flex items-start gap-2.5 rounded-md border border-border bg-muted/50 p-3">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
            />
            <span className="text-sm">
              I understand this permanently deletes all bills, purchases, and products, cannot be undone, and I want
              to proceed anyway.
            </span>
          </label>

          <Button
            type="button"
            variant="destructive"
            disabled={!acknowledged}
            onClick={() => setConfirmOpen(true)}
          >
            <Eraser className="mr-2 h-4 w-4" />
            Clear Data
          </Button>
        </CardContent>
      </Card>

      {done && (
        <Card className="border-[#4CAF50]/40">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-foreground">Done — data cleared.</p>
            <p className="mt-1 text-muted-foreground">
              Deleted {done.bills} bill{done.bills === 1 ? '' : 's'}, {done.purchases} purchase
              {done.purchases === 1 ? '' : 's'}, {done.products} product{done.products === 1 ? '' : 's'}, and{' '}
              {done.transfers} transfer log entr{done.transfers === 1 ? 'y' : 'ies'}.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!busy) setConfirmOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all bills and products?</DialogTitle>
            <DialogDescription>
              This is the final confirmation — once you click Clear Data below, every bill, purchase, and product is
              permanently gone. Godowns and accounts stay untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmReset} disabled={busy}>
              {busy ? 'Clearing…' : 'Clear Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
