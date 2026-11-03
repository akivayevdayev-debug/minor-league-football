import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMember } from '../auth'
import { useDatabaseCheck } from './devApi'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { AppInfoRow } from './AppInfoRow'
import { HistorySection } from './HistorySection'
import { LoginsSection } from './LoginsSection'
import { RecordEditor } from './RecordEditor'

/** Owner only. Everyone else who opens /dev is sent to the home screen. */
export default function DevToolsPage() {
  const member = useMember()
  if (!member.isOwner) return <Navigate to="/" replace />
  return <DevTools />
}

function DevTools() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline leading-none">Developer tools</h1>
        <p className="text-small text-text-2">For Akiva only. Changes here are real, and the league sees them straight away.</p>
      </header>
      <LoginsSection />
      <HistorySection />
      <RecordEditor />
      <AppInfo />
    </section>
  )
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

function AppInfo() {
  const check = useDatabaseCheck()
  const online = useOnline()
  const database = check.isPending
    ? 'Checking…'
    : check.isError
      ? 'No answer'
      : `Answered in ${check.data.ms} ms`

  return (
    <section aria-labelledby="info-title" className="flex flex-col gap-2">
      <h2 id="info-title" className="caps-label px-3">App info</h2>
      <ul className="glass-subtle flex flex-col overflow-hidden rounded-panel">
        <AppInfoRow label="Version" value={__APP_VERSION__} />
        <AppInfoRow
          label="Database"
          value={database}
          action={
            <Button size="sm" variant="outline" loading={check.isFetching} onClick={() => void check.refetch()}>
              Check again
            </Button>
          }
        />
        <AppInfoRow
          label="This phone"
          value={online ? 'Online' : 'Offline'}
          icon={<Icon name={online ? 'online' : 'offline'} size="sm" className="text-text-2" />}
        />
      </ul>
    </section>
  )
}
