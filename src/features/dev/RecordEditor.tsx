import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Select } from '../../ui/Select'
import { buildChanges, EDITABLE_TABLES, editableFields, rowLabel, tableLabel, toEditText, type Row } from './devLogic'
import { useNameIndex, useRecords, useSaveRecord } from './devApi'

const MAX_MATCHES = 20

/** Repair tool: pick a table, find a row by name or id, change its fields. Only changed fields are saved. */
export function RecordEditor() {
  const [table, setTable] = useState('')
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const records = useRecords(table)
  const names = useNameIndex()

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (records.data ?? []).filter(
      (r) => !q || rowLabel(table, r, names).toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q),
    )
    return list.slice(0, MAX_MATCHES)
  }, [records.data, query, table, names])

  const picked = records.data?.find((r) => String(r.id) === chosen) ?? null

  return (
    <section aria-labelledby="record-title" className="flex flex-col gap-2">
      <h2 id="record-title" className="caps-label px-3">Edit a record</h2>
      <div className="glass-list flex flex-col gap-3 rounded-panel p-3">
        <Select
          label="Table"
          value={table}
          onChange={(e) => {
            setTable(e.target.value)
            setQuery('')
            setChosen(null)
          }}
        >
          <option value="">Choose a table</option>
          {EDITABLE_TABLES.map((t) => (
            <option key={t} value={t}>{tableLabel(t)}</option>
          ))}
        </Select>

        {table !== '' && (
          <>
            <Field label="Find a row" type="search" placeholder="Name or id" value={query} onChange={(e) => setQuery(e.target.value)} />
            {records.isError && <p role="alert" className="text-small text-danger">{records.error.message}</p>}
            <ul className="flex flex-col">
              {matches.map((r) => (
                <li key={String(r.id)} className="border-t border-divider first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setChosen(String(r.id))}
                    aria-pressed={chosen === String(r.id)}
                    className="pressable lit flex min-h-(--tap-min) w-full flex-col justify-center gap-0.5 px-1 py-2 text-left hover-fine:bg-(--row-hover)"
                  >
                    <span className="text-body font-medium">
                      {rowLabel(table, r, names)}
                      {r.voided_at ? <span className="text-text-2"> · Voided</span> : null}
                    </span>
                    <span className="nums text-small text-text-2 break-all">{String(r.id)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {records.data && matches.length === 0 && <p className="text-small text-text-2">No rows match.</p>}
          </>
        )}

        {picked && <RecordForm key={String(picked.id)} table={table} row={picked} onClose={() => setChosen(null)} />}
      </div>
    </section>
  )
}

function RecordForm({ table, row, onClose }: { table: string; row: Row; onClose(): void }) {
  const save = useSaveRecord()
  const fields = editableFields(row)
  const [edited, setEdited] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, toEditText(row[f])])))

  async function run() {
    let changes: Row
    try {
      changes = buildChanges(row, edited)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read one of those values.")
      return
    }
    if (Object.keys(changes).length === 0) {
      toast('Nothing to save.')
      return
    }
    try {
      await save.mutateAsync({ table, id: String(row.id), changes })
      toast('Saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.")
    }
  }

  return (
    <div className="surface-inset flex flex-col gap-3 rounded-panel p-3">
      <p className="text-small text-text-2">Editing {tableLabel(table).toLowerCase()} · {String(row.id)}</p>
      {fields.map((f) => (
        <Field
          key={f}
          label={f.replace(/_/g, ' ')}
          value={edited[f] ?? ''}
          onChange={(e) => {
            const text = e.target.value
            setEdited((prev) => ({ ...prev, [f]: text }))
          }}
        />
      ))}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={save.isPending}>
          Close
        </Button>
        <Button variant="primary" className="flex-1" loading={save.isPending} onClick={() => void run()}>
          Save
        </Button>
      </div>
    </div>
  )
}
