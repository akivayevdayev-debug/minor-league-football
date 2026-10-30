import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAddGame, useTeams } from '../league'
import { fromZonedInput, ZONE_LABEL } from '../../lib/time'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'

interface Props {
  open: boolean
  onOpenChange(open: boolean): void
  seasonId: string
  defaultWeek: number
}

/** Any number of games per week. The time can be left blank and set later. */
export function AddGameSheet({ open, onOpenChange, seasonId, defaultWeek }: Props) {
  const teams = useTeams()
  const addGame = useAddGame()
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [week, setWeek] = useState(String(defaultWeek))
  const [when, setWhen] = useState('')

  const weekNumber = Number(week)
  const weekBad = !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 99
  const same = home !== '' && home === away
  const ready = home && away && !same && !weekBad

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    try {
      await addGame.mutateAsync({
        season_id: seasonId,
        week: weekNumber,
        home_team_id: home,
        away_team_id: away,
        starts_at: when ? fromZonedInput(when) : null,
      })
      toast.success('Game added')
      setHome('')
      setAway('')
      setWhen('')
      onOpenChange(false)
    } catch {
      toast.error("Couldn't add the game. Check your signal and try again.")
    }
  }

  const teamOptions = (teams.data ?? []).map((t) => (
    <option key={t.id} value={t.id}>
      {t.name}
    </option>
  ))

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add game"
      footer={
        <Button type="submit" form="add-game" variant="primary" className="flex-1" loading={addGame.isPending} disabled={!ready}>
          Add game
        </Button>
      }
    >
      <form id="add-game" onSubmit={submit} className="flex flex-col gap-4">
        <Select label="Team 1" value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">Choose a team</option>
          {teamOptions}
        </Select>
        <Select label="Team 2" value={away} onChange={(e) => setAway(e.target.value)} error={same ? 'Pick two different teams.' : undefined}>
          <option value="">Choose a team</option>
          {teamOptions}
        </Select>
        <Field
          label="Week"
          inputMode="numeric"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          error={weekBad ? 'Use a week number from 1 to 99.' : undefined}
        />
        <Field label={`Date and time (${ZONE_LABEL}, optional)`} type="datetime-local" className="nums" value={when} onChange={(e) => setWhen(e.target.value)} />
      </form>
    </Sheet>
  )
}
