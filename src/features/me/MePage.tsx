import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChangePasswordForm, useAuth, useMember } from '../auth'
import { displayName, ordinal, recordText, usePlayers, useSeasonSnapshot } from '../league'
import { exportEverything } from '../settings/export'
import { Badge } from '@/components/ui/badge'
import { Icon, type IconName } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Sheet } from '../../ui/Sheet'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { StatBox } from '../../ui/StatBox'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'

/** You: a compact profile, your team's numbers, and a grouped settings list. */
export default function MePage() {
  const member = useMember()
  const { signOut } = useAuth()
  const players = usePlayers()
  const snap = useSeasonSnapshot(member.playerId)
  const [password, setPassword] = useState(false)
  const [install, setInstall] = useState(false)
  const [exporting, setExporting] = useState(false)
  const me = players.data?.find((p) => p.id === member.playerId)
  const team = snap.myTeam

  async function runExport() {
    setExporting(true)
    try {
      await exportEverything()
      toast.success('Backup saved to your downloads')
    } catch {
      toast.error("Couldn't make the backup. Check your signal and try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <header
        className="rise relative isolate flex items-center gap-4 overflow-hidden rounded-hero p-4"
        style={teamStyle(team?.color_key)}
      >
        <StadiumBackdrop photo="sunset" team={team?.color_key} />
        <PlayerBadge jersey={me?.jersey ?? null} team={team?.color_key} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="text-headline leading-none">{me ? displayName(me) : 'You'}</h1>
          <p className="flex flex-wrap items-center gap-2 text-small text-text-2-strong">
            {team && <TeamBadge team={team} size="sm" />}
            <span>{team?.name ?? 'No team yet'}</span>
          </p>
          {member.isLeagueManager && (
            <div>
              <Badge variant="gold">
                <Icon name="crown" size="xs" filled /> League manager
              </Badge>
            </div>
          )}
        </div>
      </header>

      {snap.myRow && (
        <dl className="rise glass-panel grid grid-cols-3 gap-3 rounded-panel p-4" style={{ '--i': 1 } as CSSProperties}>
          <StatBox label="Record" value={recordText(snap.myRow)} />
          <StatBox label="Rank" value={ordinal(snap.myRow.rank)} accent={snap.myRow.rank === 1} />
          <StatBox label="PF" value={snap.myRow.points_for} count />
        </dl>
      )}

      <ul className="rise glass-panel flex flex-col overflow-hidden rounded-panel" style={{ '--i': 2 } as CSSProperties}>
        <Row icon="me" label="My profile" to={`/players/${member.playerId}`} />
        <Row icon="lock" label="Change password" onClick={() => setPassword(true)} />
        <Row icon="export" label={exporting ? 'Saving backup…' : 'Export everything'} hint="Every list in one file" onClick={runExport} />
        <Row icon="device" label="Put MLF on your phone" onClick={() => setInstall(true)} />
      </ul>

      <ul className="rise glass-panel overflow-hidden rounded-panel" style={{ '--i': 3 } as CSSProperties}>
        <li>
          <button
            type="button"
            onClick={() => void signOut()}
            className="pressable lit flex min-h-(--tap-min) w-full items-center justify-center gap-2 px-3 py-2.5 font-strong text-danger hover-fine:bg-(--row-hover)"
          >
            <Icon name="sign-out" size="sm" />
            Sign out
          </button>
        </li>
      </ul>

      <section aria-labelledby="about-title" className="rise flex flex-col gap-2" style={{ '--i': 4 } as CSSProperties}>
        <h2 id="about-title" className="caps-label px-3">About</h2>
        <ul className="glass-subtle flex flex-col overflow-hidden rounded-panel">
          <li className="flex min-h-(--tap-min) items-center gap-3 px-3 py-2.5">
            <Icon name="info" size="sm" className="text-text-3" />
            <span className="flex-1 text-body">Version</span>
            <span className="nums text-small text-text-2">{__APP_VERSION__}</span>
          </li>
          <li className="border-t border-divider px-3 py-2.5 text-small text-text-2">
            Stadium photos from Unsplash: @weirick, @s2killa, @andrewgearhart, @24ameer
          </li>
        </ul>
      </section>

      <Sheet open={password} onOpenChange={setPassword} title="Change password">
        <ChangePasswordForm />
      </Sheet>
      <Sheet open={install} onOpenChange={setInstall} title="Put MLF on your phone" description="It opens like an app, full screen.">
        <ol className="flex flex-col gap-3 text-text-2-strong">
          <li><span className="font-strong text-text">iPhone:</span> open MLF in Safari, tap Share, then Add to Home Screen.</li>
          <li><span className="font-strong text-text">Android:</span> open the browser menu and tap Install app.</li>
        </ol>
      </Sheet>
    </section>
  )
}

function Row({ icon, label, hint, to, onClick }: { icon: IconName; label: string; hint?: string; to?: string; onClick?: () => void }) {
  const body: ReactNode = (
    <>
      <span className="flex size-(--badge-sm) shrink-0 items-center justify-center rounded-control bg-(--press-fill) text-text">
        <Icon name={icon} size="sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-medium">{label}</span>
        {hint && <span className="text-small text-text-2">{hint}</span>}
      </span>
      <Icon name="chevron" size="xs" className="text-text-3" />
    </>
  )
  const cls = 'lit flex min-h-(--tap-min) w-full items-center gap-3 px-3 py-2.5 text-left hover-fine:bg-(--row-hover)'
  return (
    <li className="border-t border-divider first:border-t-0">
      {to ? (
        <Link to={to} className={cls}>{body}</Link>
      ) : (
        <button type="button" onClick={onClick} className={`pressable ${cls}`}>{body}</button>
      )}
    </li>
  )
}
