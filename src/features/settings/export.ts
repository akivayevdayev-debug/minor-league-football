import { supabase } from '../../lib/supabase'
import { EXPORT_TABLES } from '../../types/db'

const PAGE = 1000 // Supabase returns at most 1000 rows per request

async function readAll(table: string): Promise<unknown[]> {
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error('Export failed')
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

/** Downloads every table as one JSON file (free-plan backup, database plan 8.7). */
export async function exportEverything(): Promise<void> {
  const tables: Record<string, unknown[]> = {}
  for (const t of EXPORT_TABLES) tables[t] = await readAll(t)
  const file = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), tables }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = `mlf-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // Safari needs the link alive briefly
}
