import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUpdatePlayer, type PlayerChanges } from '../league'
import { uploadPhoto } from '../../lib/photos'
import type { Player } from '../../types/db'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { PhotoField } from '../../ui/PhotoField'
import { Sheet } from '../../ui/Sheet'

interface Props {
  player: Player
  open: boolean
  onOpenChange(open: boolean): void
}

/** Edit the everyday fields. Every change is kept in the edit history. Guests can be removed (voided). */
export function EditPlayerSheet({ player, open, onOpenChange }: Props) {
  const update = useUpdatePlayer()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(player.nickname ?? '')
  const [jersey, setJersey] = useState(player.jersey?.toString() ?? '')
  const [positions, setPositions] = useState(player.positions.join(', '))
  const [achievements, setAchievements] = useState(player.achievements)

  const jerseyNumber = jersey.trim() === '' ? null : Number(jersey)
  const jerseyBad = jerseyNumber !== null && (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99)

  async function save(changes: PlayerChanges, done: string) {
    try {
      await update.mutateAsync({ id: player.id, changes })
      toast.success(done)
      onOpenChange(false)
      return true
    } catch {
      toast.error("Couldn't save. Check your signal and try again.")
      return false
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (jerseyBad) return
    void save(
      {
        nickname: nickname.trim() || null,
        jersey: jerseyNumber,
        positions: positions.split(',').map((s) => s.trim()).filter(Boolean),
        achievements: achievements.trim(),
      },
      'Player saved',
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit player"
      footer={
        <Button type="submit" form="edit-player" variant="primary" className="w-full" loading={update.isPending} disabled={jerseyBad}>
          Save player
        </Button>
      }
    >
      <form id="edit-player" onSubmit={submit} className="flex flex-col gap-3">
        <PhotoField
          label="Player photo"
          hint="Saves as soon as you pick it. A face close-up works best."
          shape="round"
          path={player.photo_path}
          placeholder={<span className="numeral text-score text-text-3">{player.jersey ?? '–'}</span>}
          onPick={async (file) => {
            const path = await uploadPhoto('player', player.id, file)
            await update.mutateAsync({ id: player.id, changes: { photo_path: path } }).catch(() => {
              throw new Error("Couldn't save the photo. Check your signal and try again.")
            })
          }}
        />
        <Field label="Nickname" className="gap-1" hint="What the app shows. Leave blank to use the full name." maxLength={40} value={nickname} onChange={(e) => setNickname(e.target.value)} />
        <Field
          label="Jersey number"
          className="gap-1"
          inputMode="numeric"
          hint="0 to 99, or blank."
          error={jerseyBad ? 'Use a whole number from 0 to 99.' : undefined}
          value={jersey}
          onChange={(e) => setJersey(e.target.value)}
        />
        <Field label="Positions" className="gap-1" hint="Separate with commas, e.g. Corner, WR." value={positions} onChange={(e) => setPositions(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label htmlFor="achievements" className="caps-label">
            Achievements
          </label>
          <textarea
            id="achievements"
            rows={2}
            maxLength={2000}
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
            className="field-control"
          />
        </div>
        {player.is_guest && (
          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (await save({ voided_at: new Date().toISOString() }, `${player.full_name} removed. The owner can restore them.`)) {
                navigate('/roster')
              }
            }}
          >
            Remove guest
          </Button>
        )}
      </form>
    </Sheet>
  )
}
