import { Download, Repeat2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { exportCsv } from '@/lib/exportCsv'
import { useInventoryStore } from '@/store/inventoryStore'
import type { Godown } from '@/types'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function godownName(godownId: string, godowns: Godown[]) {
  return godowns.find((godown) => godown.id === godownId)?.name ?? godownId
}

export function TransferLogPage() {
  const transferLog = useInventoryStore((state) => state.transferLog)
  const godowns = useInventoryStore((state) => state.godowns)
  const sortedLog = [...transferLog].sort((a, b) => b.transferredAt.localeCompare(a.transferredAt))

  function exportTransfers() {
    exportCsv(
      'transfer-log.csv',
      ['Date', 'Product', 'From', 'To', 'Qty', 'By'],
      sortedLog.map((entry) => [
        new Date(entry.transferredAt).toISOString(),
        entry.productName,
        godownName(entry.fromGodownId, godowns),
        godownName(entry.toGodownId, godowns),
        entry.qty,
        entry.transferredBy,
      ])
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Transfer Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Godown movement history for inventory products.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={exportTransfers}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedLog.length === 0 ? (
            <EmptyState
              icon={Repeat2}
              title="No transfers yet"
              message="Completed godown transfers will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>From Godown</TableHead>
                  <TableHead>To Godown</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Transferred By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(entry.transferredAt)}</TableCell>
                    <TableCell className="font-medium">{entry.productName}</TableCell>
                    <TableCell>{godownName(entry.fromGodownId, godowns)}</TableCell>
                    <TableCell>{godownName(entry.toGodownId, godowns)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{entry.qty}</TableCell>
                    <TableCell>{entry.transferredBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
