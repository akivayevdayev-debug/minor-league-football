import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useTeams, useUpdateTeam, type TeamChanges } from '../league'
import { uploadPhoto, type PhotoKind } from '../../lib/photos'
import type { Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { PhotoField } from '../../ui/PhotoField'
import { Sheet } from '../../ui/Sheet'
import { TeamBadge } from '../../ui/TeamBadge'

interface Props {
  team: Team
  open: boolean
  onOpenChange(open: boolean): void
}

/** Edit a team: its name and short name (saved with the button), logo and team photo (each saves when picked). */
export function TeamPhotosSheet({ team: initial, open, onOpenChange }: Props) {
  const teams = useTeams()
  const update = useUpdateTeam()
  const team = teams.data?.find((t) => t.id === initial.id) ?? initial
  const [name, setName] = useState(team.name)
  const [short, setShort] = useState(team.short_name)

  // Limits match the database checks: name 1–40 characters and unique, short name 1–12.
  const cleanName = name.trim()
  const cleanShort = short.trim()
  const taken = (teams.data ?? []).some((t) => t.id !== team.id && t.name.trim().toLowerCase() === cleanName.toLowerCase())
  const nameError = !cleanName ? 'Give the team a name.' : cleanName.length > 40 ? 'Keep it to 40 characters.' : taken ? 'Another team already has that name.' : undefined
  const shortError = !cleanShort ? 'Give it a short name, like TIG.' : cleanShort.length > 12 ? 'Keep it to 12 characters.' : undefined
  const unchanged = cleanName === team.name && cleanShort === team.short_name

  async function rename(e: FormEvent) {
    e.preventDefault()
    if (nameError || shortError || unchanged) return
    try {
      await update.mutateAsync({ id: team.id, changes: { name: cleanName, short_name: cleanShort } })
      toast.success('Team name saved')
    } catch {
      toast.error("Couldn't save the name. Check your signal and try again.")
    }
  }

  const save = (kind: Exclude<PhotoKind, 'player'>, column: keyof TeamChanges) => async (file: File) => {
    const path = await uploadPhoto(kind, team.id, file)
    await update.mutateAsync({ id: team.id, changes: { [column]: path } }).catch(() => {
      throw new Error("Couldn't save the photo. Check your signal and try again.")
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Edit team">
      <div className="flex flex-col gap-5">
        <form onSubmit={rename} className="flex flex-col gap-3">
          <Field label="Team name" value={name} maxLength={40} error={name !== team.name ? nameError : undefined} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Short name"
            hint="Shown on scoreboards and buttons, e.g. TIG."
            value={short}
            maxLength={12}
            error={short !== team.short_name ? shortError : undefined}
            onChange={(e) => setShort(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="md" disabled={unchanged || !!nameError || !!shortError} loading={update.isPending}>
            Save name
          </Button>
        </form>
        <PhotoField
          label="Team logo"
          hint="Shown in the team crest on every screen. A square logo works best."
          shape="shield"
          path={team.logo_path}
          placeholder={<TeamBadge team={{ ...team, logo_path: null }} size="lg" />}
          onPick={save('logo', 'logo_path')}
        />
        <PhotoField
          label="Team photo"
          hint="A group shot, shown at the top of this team's Roster."
          shape="wide"
          path={team.photo_path}
          onPick={save('team-photo', 'photo_path')}
        />
      </div>
    </Sheet>
  )
}
