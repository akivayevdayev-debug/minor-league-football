import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { LEAGUE_ZONE } from '../../lib/time'
import { EDITABLE_TABLES, changedFields, formatValue, rowLabel, tableLabel } from './devLogic'
import { useEditHistory, useMemberLogins, useNameIndex, useUndoChange, type HistoryRow } from './devApi'

const SHOWN_LINES = 6

function whenText(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone: LEAGUE_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** The latest 50 changes, newest first. Undo puts a changed row back; a new row is voided, never deleted. */
export function HistorySection() {
  const [table, setTable] = useState('')
  const history = useEditHistory(table)
  const memberLogins = useMemberLogins()
  const names = useNameIndex()
  const [undo, setUndo] = useState<HistoryRow | null>(null)
  const [undoOpen, setUndoOpen] = useState(false)

  const whoName = (userId: string | null) => {
    if (!userId) return 'Unknown'
    const link = memberLogins.data?.find((l) => l.user_id === userId)
    return (link && names.get(link.player_id)) || 'Unknown'
  }

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-2">
      <h2 id="history-title" className="caps-label px-3">Edit history</h2>
      <div className="glass-list flex flex-col gap-3 rounded-panel p-3">
        <Select label="Show" value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">All tables</option>
          {EDITABLE_TABLES.map((t) => (
            <option key={t} value={t}>{tableLabel(t)}</option>
          ))}
        </Select>

        {history.isPending && <Skeleton rows={3} />}
        {history.isError && <p role="alert" className="text-small text-danger">{history.error.message}</p>}
        {history.data?.length === 0 && <p className="text-small text-text-2">No changes yet.</p>}

        <ul className="flex flex-col">
          {history.data?.map((row) => {
            const subject = rowLabel(row.table_name, row.after ?? row.before ?? {}, names)
            const lines = changedFields(row.before, row.after)
            return (
              <li key={row.id} className="flex flex-col gap-1.5 border-t border-divider py-3 first:border-t-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-body font-medium">
                    {tableLabel(row.table_name)} {row.action === 'insert' ? 'added' : 'changed'}
                    {subject && <span className="text-text-2">: {subject}</span>}
                  </span>
                  <span className="nums shrink-0 text-small text-text-2">{whenText(row.changed_at)}</span>
                </div>
                <span className="text-small text-text-2">By {whoName(row.changed_by)}</span>
                {lines.length === 0 && <span className="text-small text-text-2">No visible fields changed.</span>}
                <ul className="flex flex-col gap-0.5 text-small">
                  {lines.slice(0, SHOWN_LINES).map((l) => (
                    <li key={l.field} className="break-words">
                      <span className="text-text-2">{l.field.replace(/_/g, ' ')}: </span>
                      {l.from === undefined ? formatValue(l.to) : `${formatValue(l.from)} → ${formatValue(l.to)}`}
                    </li>
                  ))}
                  {lines.length > SHOWN_LINES && <li className="text-text-2">and {lines.length - SHOWN_LINES} more</li>}
                </ul>
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUndo(row)
                      setUndoOpen(true)
                    }}
                  >
                    Undo
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <UndoSheet change={undo} open={undoOpen} onOpenChange={setUndoOpen} />
    </section>
  )
}

function UndoSheet({ change, open, onOpenChange }: { change: HistoryRow | null; open: boolean; onOpenChange(open: boolean): void }) {
  const undo = useUndoChange()
  const isNew = change?.action === 'insert'

  async function run() {
    if (!change) return
    try {
      await undo.mutateAsync(change.id)
      toast('Change undone.')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't undo that change. Try again.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !undo.isPending && onOpenChange(next)} title="Undo this change?" description="Puts the row back the way it was.">
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-2-strong">
          {isNew
            ? `This new ${change ? tableLabel(change.table_name).toLowerCase() : 'row'} is hidden (voided), not deleted.`
            : `This row goes back to how it was before this change.`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={undo.isPending}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" loading={undo.isPending} onClick={() => void run()}>
            Undo change
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
