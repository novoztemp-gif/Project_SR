
import * as React from 'react'
import { Eye, EyeOff, GripVertical, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SECTION_COLORS } from '@/lib/constants'
import { type Counter, useCounterStore } from '@/store/counterStore'
import type { SectionType } from '@/types'

const PROCESSES: SectionType[] = ['Glass & Plywood', 'Plumbing', 'Painting', 'Electrical', 'Hardware']

interface CounterForm {
  label: string
  name: string
  process: SectionType[]
  active: boolean
  /** Blank = keep the current password unchanged (edit) / use the server
   * default (add) — only a non-blank value ever reaches the API. */
  password: string
}

const EMPTY_FORM: CounterForm = {
  label: '',
  name: '',
  process: ['Glass & Plywood'],
  active: true,
  password: '',
}

function processBadgeStyle(process: SectionType) {
  const color = SECTION_COLORS[process] ?? '#5F9598'
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}40`,
    color,
  }
}

export function CounterManagementPage() {
  const counters = useCounterStore((state) => state.counters)
  const addCounter = useCounterStore((state) => state.addCounter)
  const updateCounter = useCounterStore((state) => state.updateCounter)
  const deleteCounter = useCounterStore((state) => state.deleteCounter)
  const reorderCounters = useCounterStore((state) => state.reorderCounters)
  const [editingCounter, setEditingCounter] = React.useState<Counter | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [form, setForm] = React.useState<CounterForm>(EMPTY_FORM)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)

  function openAdd() {
    setEditingCounter(null)
    setForm(EMPTY_FORM)
    setShowPassword(false)
    setFormOpen(true)
  }

  function openEdit(counter: Counter) {
    setEditingCounter(counter)
    setForm({
      label: counter.label,
      name: counter.name,
      process: counter.process,
      active: counter.active,
      password: '',
    })
    setShowPassword(false)
    setFormOpen(true)
  }

  // A counter covers exactly one section — kept as a length-1 array so it
  // still matches the wire/DB shape (Section[]) without a schema change.
  function selectProcess(process: SectionType) {
    setForm((current) => ({ ...current, process: [process] }))
  }

  async function saveCounter() {
    if (!form.label.trim() || !form.name.trim()) {
      toast.error('Counter label and full name are required.')
      return
    }
    if (form.process.length === 0) {
      toast.error('Select a process.')
      return
    }
    if (form.password.trim() && form.password.trim().length < 4) {
      toast.error('Password must be at least 4 characters.')
      return
    }

    const data = {
      label: form.label.trim(),
      name: form.name.trim(),
      process: form.process,
      active: form.active,
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
    }

    try {
      if (editingCounter) await updateCounter(editingCounter.id, data)
      else await addCounter(data)
      toast.success('Counter saved.')
      setFormOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save counter')
    }
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const ids = counters.map((counter) => counter.id)
    const fromIndex = ids.indexOf(draggingId)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const nextIds = [...ids]
    nextIds.splice(fromIndex, 1)
    nextIds.splice(toIndex, 0, draggingId)
    reorderCounters(nextIds)
    setDraggingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Counter Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, configure, and manage billing counters.
          </p>
        </div>
        <Button type="button" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add counter
        </Button>
      </div>

      {counters.length === 0 ? (
        <EmptyState icon={Users} title="No counters configured" message="Add a counter to begin." />
      ) : (
        <div className="space-y-3">
          {counters.map((counter) => (
            <Card
              key={counter.id}
              draggable
              onDragStart={() => setDraggingId(counter.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(counter.id)}
              className="bg-background"
            >
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {counter.initials}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{counter.label}</Badge>
                    <Badge variant={counter.active ? 'secondary' : 'outline'}>
                      {counter.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <h2 className="mt-2 truncate text-base font-medium">{counter.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {counter.process.map((process) => (
                      <Badge key={process} variant="outline" style={processBadgeStyle(process)}>{process}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(counter)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (counter.active) deleteCounter(counter.id)
                      else updateCounter(counter.id, { ...counter, active: true })
                    }}
                  >
                    {counter.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCounter ? 'Edit counter' : 'Add counter'}</DialogTitle>
            <DialogDescription>
              Configure who can sign in and which process they can access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="counterLabel">Counter label</Label>
              <Input
                id="counterLabel"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="COUNTER 3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="counterName">Full name</Label>
              <Input
                id="counterName"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="counterPassword">
                {editingCounter ? 'New password' : 'Password'}
              </Label>
              <div className="relative">
                <Input
                  id="counterPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={editingCounter ? 'Leave blank to keep current password' : 'Leave blank for the default password'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {editingCounter && (
                <p className="text-xs text-muted-foreground">
                  Setting a new password immediately replaces the old one — it stops working right away.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Process</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROCESSES.map((process) => (
                  <label key={process} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="process"
                      checked={form.process.includes(process)}
                      onChange={() => selectProcess(process)}
                      className="h-4 w-4 accent-primary"
                    />
                    {process}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              Active
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveCounter}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
