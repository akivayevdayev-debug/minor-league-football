import { useSearchParams } from 'react-router-dom'
import { Segmented, SegmentedPanel } from '../../ui/motion'
import { PlayerList } from './PlayerList'
import { TeamsPanel } from './TeamsPanel'

const TABS = [
  { value: 'players', label: 'Players' },
  { value: 'teams', label: 'Teams' },
] as const

type TabId = (typeof TABS)[number]['value']

/** Players tab: people and teams. The open tab lives in the link (?tab=teams). */
export default function PlayersPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabId = params.get('tab') === 'teams' ? 'teams' : 'players'

  return (
    <section className="flex flex-col gap-5">
      <header className="rise flex flex-col gap-1">
        <p className="brand-type text-small text-accent">The league</p>
        <h1 className="text-headline">{tab === 'teams' ? 'Teams' : 'Players'}</h1>
      </header>
      <Segmented
        label="Show"
        value={tab}
        onChange={(v) => setParams(v === 'players' ? {} : { tab: v }, { replace: true })}
        options={TABS}
        className="rise"
      >
        <SegmentedPanel value="players">
          <PlayerList />
        </SegmentedPanel>
        <SegmentedPanel value="teams">
          <TeamsPanel />
        </SegmentedPanel>
      </Segmented>
    </section>
  )
}
