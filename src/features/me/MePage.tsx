import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChangePasswordForm, useAuth, useMember } from '../auth'
import { displayName, ordinal, recordText, usePlayers, useSeasonSnapshot } from '../league'
import { exportEverything } from '../settings/export'
import { Badge } from '@/components/ui/badge'
import { Button } from '../../ui/Button'
import { Icon, type IconName } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Sheet } from '../../ui/Sheet'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { StatBox } from '../../ui/StatBox'

/** You: profile card, your team's numbers, account and app settings. */
export default function MePage() {
  const member = useMember()
  const { signOut } = useAuth()
  const players = usePlayers()
  const snap = useSeasonSnapshot(member.playerId)
  const [password, setPassword] = useState(false)
  const [install, setInstall] = useState(false)
  const [exporting, setExporting] = useState(false)
  const me = players.data?.find((p) => p.id === member.playerId)

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
    <section className="flex flex-col gap-6">
      <header className="rise relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-hero px-5 pt-10 pb-6 text-center">
        <StadiumBackdrop team={snap.myTeam?.color_key} />
        <PlayerBadge jersey={me?.jersey ?? null} team={snap.myTeam?.color_key} size="xl" />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-headline leading-none">{me ? displayName(me) : 'You'}</h1>
          <p className="text-text-2-strong">{snap.myTeam?.name ?? 'No team yet'}</p>
        </div>
        {member.isLeagueManager && (
          <Badge variant="accent">
            <Icon name="crown" size="xs" filled /> League manager
          </Badge>
        )}
      </header>

      {snap.myRow && (
        <dl className="rise glass-panel grid grid-cols-3 gap-4 rounded-panel p-5" style={{ '--i': 1 } as CSSProperties}>
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
        <li className="flex min-h-(--tap-min) items-center gap-3 border-t border-divider px-4 py-3 text-text-2">
          <Icon name="info" size="sm" />
          <span className="flex-1">Version</span>
          <span className="nums">{__APP_VERSION__}</span>
        </li>
      </ul>

      <Button variant="outline" size="xl" onClick={() => void signOut()}>
        <Icon name="sign-out" size="sm" />
        Sign out
      </Button>

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
      <span className="flex size-(--badge-sm) items-center justify-center rounded-control bg-accent-soft text-accent">
        <Icon name={icon} size="sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-strong">{label}</span>
        {hint && <span className="text-small text-text-2">{hint}</span>}
      </span>
      <Icon name="chevron" size="xs" className="text-text-3" />
    </>
  )
  const cls = 'lit flex min-h-(--tap-game) w-full items-center gap-3 px-4 py-2 text-left hover-fine:bg-(--row-hover)'
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
