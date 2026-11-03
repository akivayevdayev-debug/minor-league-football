import { Select } from '../../ui/Select'
import { useSeasons } from './api'
import { selectableSeasons, useViewedSeason } from './season'

/** The season switcher: a plain select at the top of Standings, Schedule and the player profile. */
export function SeasonSelect() {
  const seasons = useSeasons()
  const [season, setSeason] = useViewedSeason()
  const options = selectableSeasons(seasons.data ?? [])
  if (!season || options.length === 0) return null
  return (
    <Select label="Season" value={season.id} onChange={(e) => setSeason(e.target.value)}>
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  )
}
