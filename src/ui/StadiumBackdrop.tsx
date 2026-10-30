import type { CSSProperties } from 'react'
import type { TeamColor } from '../types/db'
import { teamVar } from './team'

/** Drawn night stadium behind a hero (or a photo once --hero-photo is set). Decorative only. */
export function StadiumBackdrop({ team, lightsOn = false }: { team?: TeamColor; lightsOn?: boolean }) {
  const style = team ? ({ '--team': teamVar(team) } as CSSProperties) : undefined
  return (
    <div aria-hidden="true" className="stadium" style={style}>
      <div className={lightsOn ? 'lights-on absolute inset-0' : 'absolute inset-0'}>
        <div className="stadium-beam" data-side="left" />
        <div className="stadium-beam" data-side="right" />
        <div className="stadium-lamp" data-side="left" />
        <div className="stadium-lamp" data-side="right" />
      </div>
      <div className="stadium-haze" />
      <div className="stadium-field" />
      <div className="stadium-shade" />
    </div>
  )
}
