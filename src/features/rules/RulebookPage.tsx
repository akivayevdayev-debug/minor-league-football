import { useMemo, useState, type CSSProperties } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Icon } from '../../ui/Icon'
import { RULEBOOK, searchRules, type Penalty, type Rule, type Section } from './rulebook'

/** Rule numbers ("3.6") from the full book, so they stay the same while searching. */
const RULE_NUMBER = new Map(RULEBOOK.flatMap((s) => s.rules.map((r, i) => [r.id, `${s.number}.${i + 1}`] as const)))

const jumpOffset = { scrollMarginTop: 'calc(var(--header-height) + var(--header-top) + var(--space-unit) * 4)' } as CSSProperties

/** The official league rulebook: searchable, with quick jumps to each section. */
export default function RulebookPage() {
  const [query, setQuery] = useState('')
  const sections = useMemo(() => searchRules(query), [query])
  const searching = query.trim() !== ''

  function jump(id: string) {
    document.getElementById(`rules-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="rise flex flex-col gap-1">
        <h1 className="text-headline leading-none">Rulebook</h1>
        <p className="text-small text-text-2">Official two-hand touch rules. When something isn’t covered, the referee decides.</p>
      </header>

      <label className="rise relative" style={{ '--i': 1 } as CSSProperties}>
        <span className="sr-only">Search the rules</span>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-2">
          <Icon name="search" size="sm" />
        </span>
        <Input
          type="search"
          placeholder="Search the rules, like “onside” or “safety”"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </label>

      {!searching && (
        <nav aria-label="Rulebook sections" className="rise no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" style={{ '--i': 2 } as CSSProperties}>
          {RULEBOOK.map((s) => (
            <Button key={s.id} variant="secondary" size="sm" className="shrink-0" onClick={() => jump(s.id)}>
              <span className="nums text-text-2">{s.number}</span>
              {s.title}
            </Button>
          ))}
        </nav>
      )}

      {sections.length === 0 ? (
        <EmptyState icon="search" title="No rule matches that" body="Try a shorter word, like “punt” or “sack”." />
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((s) => (
            <RuleSection key={s.id} section={s} />
          ))}
        </div>
      )}
    </section>
  )
}

function RuleSection({ section }: { section: Section }) {
  return (
    <section id={`rules-${section.id}`} aria-labelledby={`rules-${section.id}-title`} className="glass-list overflow-hidden rounded-panel" style={jumpOffset}>
      <header className="surface-accent-fade flex flex-col gap-1 px-4 py-3">
        <h2 id={`rules-${section.id}-title`} className="flex items-baseline gap-2 text-title font-strong">
          <span className="nums text-accent">{section.number}</span>
          {section.title}
        </h2>
        {section.lead && <p className="text-small text-text-2-strong">{section.lead}</p>}
      </header>
      <ol className="flex flex-col">
        {section.rules.map((r) => (
          <RuleItem key={r.id} rule={r} />
        ))}
      </ol>
    </section>
  )
}

function RuleItem({ rule }: { rule: Rule }) {
  return (
    <li className="flex flex-col gap-2 border-t border-divider px-4 py-3">
      <h3 className="flex items-baseline gap-2 text-body font-strong">
        <span className="nums text-small text-text-3">{RULE_NUMBER.get(rule.id)}</span>
        {rule.title}
      </h3>
      {rule.lead && <p className="text-body text-text-2-strong">{rule.lead}</p>}
      <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-text-3">
        {rule.points.map((p) => (
          <li key={p} className="text-body text-text-2-strong">
            {p}
          </li>
        ))}
      </ul>
      {rule.penalty && <PenaltyBox penalty={rule.penalty} />}
    </li>
  )
}

function PenaltyBox({ penalty }: { penalty: Penalty }) {
  const rows: [string, string | undefined][] = [
    ['Defense', penalty.defense],
    ['Offense', penalty.offense],
    ['Penalty', penalty.either],
  ]
  return (
    <dl className="surface-inset grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded-control px-3 py-2 text-small">
      {rows
        .filter((row): row is [string, string] => Boolean(row[1]))
        .map(([who, what]) => (
          <div key={who} className="contents">
            <dt className="caps-label self-center">{who}</dt>
            <dd className="text-text">{what}</dd>
          </div>
        ))}
    </dl>
  )
}
