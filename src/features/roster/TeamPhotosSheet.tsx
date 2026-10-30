import { useTeams, useUpdateTeam, type TeamChanges } from '../league'
import { uploadPhoto, type PhotoKind } from '../../lib/photos'
import type { Team } from '../../types/db'
import { PhotoField } from '../../ui/PhotoField'
import { Sheet } from '../../ui/Sheet'
import { TeamBadge } from '../../ui/TeamBadge'

interface Props {
  team: Team
  open: boolean
  onOpenChange(open: boolean): void
}

/** Team logo (shown in the crest everywhere) and team photo (behind the Roster hero). Each saves when picked. */
export function TeamPhotosSheet({ team: initial, open, onOpenChange }: Props) {
  const teams = useTeams()
  const update = useUpdateTeam()
  const team = teams.data?.find((t) => t.id === initial.id) ?? initial

  const save = (kind: Exclude<PhotoKind, 'player'>, column: keyof TeamChanges) => async (file: File) => {
    const path = await uploadPhoto(kind, team.id, file)
    await update.mutateAsync({ id: team.id, changes: { [column]: path } }).catch(() => {
      throw new Error("Couldn't save the photo. Check your signal and try again.")
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${team.name} photos`}>
      <div className="flex flex-col gap-5">
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
