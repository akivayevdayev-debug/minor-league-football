/*
 * The official MLF rulebook (Season 2), from Akiva's text of 2026-11-03.
 * Reworded to be shorter and easier to scan, with every rule kept. Change a rule here only when
 * the league changes it: the rulebook is the source of truth for how games are played.
 */

export interface Penalty {
  /** When the defense commits it. */
  defense?: string
  /** When the offense commits it. */
  offense?: string
  /** When it applies to either side. */
  either?: string
}

export interface Rule {
  id: string
  title: string
  /** One sentence before the points, when the rule needs it. */
  lead?: string
  points: string[]
  penalty?: Penalty
}

export interface Section {
  id: string
  number: number
  title: string
  lead?: string
  rules: Rule[]
}

export const RULEBOOK: Section[] = [
  {
    id: 'setup',
    number: 1,
    title: 'League setup',
    rules: [
      {
        id: 'teams-season',
        title: 'Teams and season',
        points: [
          'Four teams, each with a captain.',
          'Each team plays with four players on the field, plus a backup quarterback.',
          'The season runs nine weeks, with two games every Sunday.',
        ],
      },
      {
        id: 'positions',
        title: 'Positions',
        points: [
          'Quarterback (QB): takes the snap and runs the offense.',
          'Wide receivers (WRs): run routes and catch passes.',
          'Offensive line / tight end (OL/TE): snaps the ball, blocks, and is an eligible receiver who can release into a route at any point in the play.',
        ],
      },
      {
        id: 'backup-qb',
        title: 'Backup quarterback',
        points: [
          'Stays on the sideline and records the team’s stats.',
          'Has one special defensive job when the other team’s QB runs (see section 7).',
        ],
      },
    ],
  },
  {
    id: 'clock',
    number: 2,
    title: 'Game length and clock',
    rules: [
      {
        id: 'duration',
        title: 'Game length',
        points: ['Two 12-minute halves, with halftime in between.', 'The referee runs the official clock.'],
      },
      {
        id: 'stoppages',
        title: 'The clock stops for',
        points: ['Timeouts.', 'Incomplete passes.', 'Plays that end out of bounds.', 'Anything else the referee stops play for.'],
      },
      {
        id: 'kickoff-clock',
        title: 'Clock on the opening kickoff',
        points: ['The clock does not run during the opening kickoff return.', 'It starts when the return is over and the offense is ready for its first play.'],
      },
      {
        id: 'timeouts',
        title: 'Timeouts',
        points: ['The captain or the QB asks for a timeout.', 'Play stops only once the referee acknowledges it.'],
      },
    ],
  },
  {
    id: 'kickoffs',
    number: 3,
    title: 'Kickoffs and returns',
    rules: [
      {
        id: 'opening-kickoff',
        title: 'Opening kickoff',
        points: [
          'Every game starts with a kickoff.',
          'The receiving team tries to catch or recover the ball and return it, and starts its drive where the return ends.',
          'The clock does not run during the opening return.',
        ],
      },
      {
        id: 'kickoff-after-td',
        title: 'After a touchdown',
        points: [
          'Once the extra-point try is over, the scoring team kicks off.',
          'The receiving team may return it and starts where the return ends.',
        ],
      },
      {
        id: 'holder',
        title: 'Holder',
        points: [
          'The ball may be kicked or thrown on a kickoff.',
          'A kicked kickoff needs a holder.',
          'The kicking team follows the referee’s instructions before the kick.',
        ],
      },
      {
        id: 'kickoff-out',
        title: 'Kickoff out of bounds',
        points: [
          'Out on the fly (no bounce in the field): the receiving team starts 10 steps before the first-down line.',
          'Bounces in the field first: the receiving team starts where it first bounced.',
          'The referee sets the exact spot.',
        ],
      },
      {
        id: 'touchbacks',
        title: 'Touchbacks',
        points: [
          'A touchback is when the ball reaches the receiving team’s end zone and the receiver chooses to kneel.',
          'The receiving team then starts halfway to the first-down line.',
        ],
      },
      {
        id: 'onside-kicks',
        title: 'Onside kicks',
        points: [
          'Allowed, but the kicking team must say so before kicking.',
          'The receiving team must touch the ball before the kicking team can legally recover it.',
          'Kicking team recovers before the receiving team touches it: the receiving team keeps the ball at the recovery spot.',
          'Receiving team touches it first and the kicking team legally recovers: the kicking team gets the ball.',
        ],
      },
    ],
  },
  {
    id: 'downs',
    number: 4,
    title: 'Downs and first downs',
    rules: [
      {
        id: 'first-downs',
        title: 'First downs',
        points: [
          'Gain at least half the length of the field for a first down.',
          'The referee decides whether the distance was reached.',
          'A first down starts a new set of downs.',
        ],
      },
      {
        id: 'four-downs',
        title: 'Four downs',
        points: [
          'The offense has four downs to reach the first-down line.',
          'On fourth down, go for it or punt.',
        ],
      },
      {
        id: 'failed-fourth',
        title: 'Failed fourth down',
        lead: 'If the offense goes for it on fourth down and falls short, the other team takes over where the play ended. Falling short includes:',
        points: ['An incomplete pass.', 'A sack.', 'Being touched before the first-down line.', 'Any other play that doesn’t reach the line.'],
      },
      {
        id: 'incomplete',
        title: 'Incomplete passes',
        points: ['Uses up a down.', 'The offense keeps the ball, and the next down starts at the right spot.'],
      },
      {
        id: 'interceptions',
        title: 'Interceptions',
        points: ['The ball changes hands immediately.', 'The defender may return it, and a return into the end zone is a touchdown.'],
      },
      {
        id: 'fumbles',
        title: 'Fumbles',
        points: [
          'A ball dropped during a live play is a fumble, and whoever recovers it gets the ball.',
          'A dropped forward pass is an incomplete pass, not a fumble.',
        ],
      },
    ],
  },
  {
    id: 'punting',
    number: 5,
    title: 'Punting',
    rules: [
      {
        id: 'fourth-down-punts',
        title: 'Fourth-down punts',
        points: [
          'Instead of going for it on fourth down, a team may punt.',
          'Toss the ball slightly into the air and kick it, as far as you like within the field.',
          'The receiving team goes to the other side and may return it, all the way for a touchdown.',
        ],
      },
      {
        id: 'punt-returns',
        title: 'Punt returns',
        points: [
          'A punt return is a live play under the normal two-hand-touch rules.',
          'The returner runs until touched, out of bounds, or in the end zone.',
          'If the returner is downed, the drive starts at that spot.',
        ],
      },
      {
        id: 'no-fake-punts',
        title: 'No fake punts',
        points: ['A team that lines up to punt must punt. No pretending to punt and running a play.'],
      },
    ],
  },
  {
    id: 'running',
    number: 6,
    title: 'Running and QB movement',
    rules: [
      {
        id: 'qb-runs',
        title: 'QB runs',
        points: [
          'The QB may run with the ball once per set of downs, on any down.',
          'After that run, no more designed QB runs until the team earns a new first down.',
        ],
      },
      {
        id: 'rollouts',
        title: 'Rollouts',
        points: [
          'A rollout is the QB moving straight out of the pocket with the ball, left or right, looking to pass or find space.',
          'Rollouts are allowed and do not count as the team’s QB run.',
          'A two-hand touch on the QB behind the line of scrimmage is a sack.',
        ],
      },
      {
        id: 'laterals',
        title: 'Laterals',
        points: [
          'Allowed. A lateral goes backward or sideways, and the receiver can keep the play going.',
          'A dropped lateral during a live play is a fumble.',
        ],
      },
      {
        id: 'flea-flickers',
        title: 'Flea flickers',
        points: ['Allowed: a lateral or handoff before a forward pass.', 'All normal passing and possession rules still apply.'],
      },
    ],
  },
  {
    id: 'extra-qb',
    number: 7,
    title: 'Extra quarterback rule',
    lead: 'The extra quarterback is each team’s backup QB.',
    rules: [
      {
        id: 'extra-qb-normal',
        title: 'Normally',
        points: ['The extra QB stays on the sideline, out of normal offense and defense, and records stats.'],
      },
      {
        id: 'extra-qb-defense',
        title: 'Special defensive role',
        points: [
          'When the other team’s QB runs with the ball, the extra QB may join that play as a defender to chase and touch him.',
          'This is the only time he may join a play.',
          'Catching a lateral does not make him part of the play.',
        ],
      },
      {
        id: 'legal-touches',
        title: 'Legal touches',
        points: [
          'The extra QB must use a legal two-hand touch.',
          'No tackling, grabbing, pushing or dangerous contact. The same safety and conduct rules apply to him as to every defender.',
        ],
      },
    ],
  },
  {
    id: 'touch',
    number: 8,
    title: 'Two-hand touch',
    rules: [
      {
        id: 'downing',
        title: 'Downing a player',
        points: [
          'The ball carrier is down when a defender clearly touches them with both hands.',
          'The play ends right then, and the ball is spotted where they were touched (the referee sets the spot).',
        ],
      },
      {
        id: 'out-of-bounds',
        title: 'Out of bounds',
        points: [
          'Out of bounds means stepping outside the marked field. The runner can’t go any further.',
          'A catch must be made in bounds.',
          'Going out of bounds stops the clock, and the referee sets the next spot.',
        ],
      },
      {
        id: 'prohibited-contact',
        title: 'Not allowed',
        points: [
          'Tackling or tripping.',
          'Pushing anyone to the ground.',
          'Grabbing clothing or holding someone back.',
          'Pushing a receiver to get open.',
          'Hitting, or trying to hit, another player.',
          'Any dangerous or out-of-control contact.',
        ],
      },
    ],
  },
  {
    id: 'receivers',
    number: 9,
    title: 'Receivers and defensive backs',
    rules: [
      {
        id: 'eligible',
        title: 'Eligible receivers',
        points: [
          'All three receiving players can catch passes, the OL/TE included.',
          'The OL/TE may block or release into a route at any point, and may catch and run with the ball.',
        ],
      },
      {
        id: 'catching',
        title: 'Making a catch',
        points: [
          'The receiver must keep hold of the ball and be in bounds.',
          'A dropped forward pass is incomplete, unless it is ruled a live-ball lateral.',
        ],
      },
      {
        id: 'coverage',
        title: 'Defensive coverage',
        points: [
          'Defensive backs may cover receivers and go for interceptions.',
          'No holding, pushing or illegally blocking a receiver’s path.',
          'After a catch, the play ends only with a legal two-hand touch.',
        ],
      },
      {
        id: 'pass-interference-def',
        title: 'Pass interference',
        points: ['Illegally contacting or blocking a player so they don’t get a fair chance at the ball. Penalty in section 13.'],
      },
    ],
  },
  {
    id: 'line',
    number: 10,
    title: 'Offensive and defensive line',
    rules: [
      {
        id: 'ol-te',
        title: 'Offensive line / tight end',
        points: [
          'Snaps the ball to the QB.',
          'Blocks for the QB or another runner, within the blocking rules below.',
          'Is an eligible receiver: may release into a route at any point, catch passes and score.',
        ],
      },
      {
        id: 'd-line',
        title: 'Defensive line',
        points: [
          'Tries to get past the offensive line and pressure the QB.',
          'Sacks need a legal two-hand touch. No tackling, grabbing or dangerous contact.',
        ],
      },
      {
        id: 'blocking',
        title: 'Blocking: not allowed',
        points: ['Below the waist.', 'Holding or grabbing.', 'Pushing from behind.', 'Tripping.', 'Charging into someone.', 'Any dangerous or out-of-control contact.'],
      },
      {
        id: 'sacks',
        title: 'Sacks',
        points: [
          'A sack is a defensive lineman’s two-hand touch on the QB behind the line of scrimmage.',
          'The play ends, the new line of scrimmage is where the QB was touched, and the down is used.',
          'Sacks count in the league stats.',
        ],
      },
    ],
  },
  {
    id: 'scoring',
    number: 11,
    title: 'Scoring',
    rules: [
      {
        id: 'touchdowns',
        title: 'Touchdown: 6 points',
        points: [
          'Carry the ball into the other team’s end zone while keeping possession.',
          'Can come from a pass, a run, an interception return, a punt return or a kickoff return.',
        ],
      },
      {
        id: 'conversions',
        title: 'Extra point: 1 or 2',
        lead: 'After a touchdown, the scoring team picks one try:',
        points: [
          '1 point: start 10 steps from the end zone and score a touchdown.',
          '2 points: start 20 steps from the end zone and score a touchdown.',
        ],
      },
      {
        id: 'failed-conversions',
        title: 'Missed extra point',
        points: ['No touchdown on the try means no extra points.', 'Either way, the scoring team then kicks off.'],
      },
      {
        id: 'safeties',
        title: 'Safety: 2 points',
        points: [
          'The QB is legally sacked in his own end zone.',
          'The defending team gets 2 points, then receives a kickoff.',
        ],
      },
    ],
  },
  {
    id: 'overtime',
    number: 12,
    title: 'Overtime',
    rules: [
      {
        id: 'ot-length',
        title: 'When and how long',
        points: ['A tie after regulation goes to an 8-minute overtime, using the league’s version of NFL overtime rules.'],
      },
      {
        id: 'ot-procedure',
        title: 'How it works',
        points: [
          'Both teams get a chance to have the ball.',
          'A team that gets a defensive stop and then scores wins right away.',
          'Still tied after both first chances: sudden death, next score wins.',
          'Still tied after 8 minutes: the referee keeps going with sudden death until someone scores.',
        ],
      },
    ],
  },
  {
    id: 'penalties',
    number: 13,
    title: 'Penalties',
    lead: 'The referee enforces every penalty, before the next snap, and may stop play right away when someone could get hurt.',
    rules: [
      {
        id: 'roughness',
        title: 'Unnecessary roughness',
        points: ['Hard pushing or shoving.', 'Dangerous contact.', 'Contact after the play is over.'],
        penalty: { defense: '10 steps and an automatic first down', offense: '10 steps back and loss of down' },
      },
      {
        id: 'holding',
        title: 'Holding',
        points: ['Grabbing clothing.', 'Holding an arm.', 'Holding someone back.'],
        penalty: { defense: '5 steps and the down is replayed', offense: '5 steps back and loss of down' },
      },
      {
        id: 'pass-interference',
        title: 'Pass interference',
        points: ['Pushing a receiver before the ball gets there.', 'Holding a receiver to stop a catch.', 'Deliberately blocking someone’s chance to catch the ball.'],
        penalty: { defense: 'Ball placed at the spot of the foul', offense: '15 steps back and loss of down' },
      },
      {
        id: 'roughing-passer',
        title: 'Roughing the passer',
        points: ['Unnecessary contact with the QB during or right after a pass.'],
        penalty: { either: '5 to 20 steps (referee decides). Serious cases can add an automatic first down.' },
      },
      {
        id: 'illegal-contact',
        title: 'Illegal contact',
        points: ['Illegally grabbing, pushing or holding back an opponent.'],
        penalty: { either: '10 steps' },
      },
      {
        id: 'holding-lineman',
        title: 'Holding a lineman',
        points: ['Holding, grabbing or holding back a lineman.'],
        penalty: { either: '7 steps' },
      },
      {
        id: 'illegal-blocking',
        title: 'Illegal blocking',
        points: ['Below the waist.', 'Pushing from behind.', 'Tripping.', 'Dangerous or out-of-control blocking.'],
        penalty: { either: '10 steps, or more if the referee rules the contact dangerous' },
      },
      {
        id: 'false-start',
        title: 'False start (offense)',
        points: ['An offensive player moves before the snap.'],
        penalty: { offense: '5 steps back, same down' },
      },
      {
        id: 'offside',
        title: 'Offside and early movement (defense)',
        points: ['A defender crosses the line of scrimmage, or moves illegally, before the snap.', 'The referee decides if it happened, and stops play when needed so no one gets an unfair edge.'],
        penalty: { defense: '5 steps and an automatic first down' },
      },
      {
        id: 'delay',
        title: 'Delay of game',
        points: ['Deliberately holding up the snap, or not restarting when the referee signals.'],
        penalty: { either: '5 steps' },
      },
      {
        id: 'arguing',
        title: 'Arguing with the referee',
        points: ['First time: a warning and 5 steps.', 'Second time: 5 steps and ejection.'],
      },
      {
        id: 'threatening',
        title: 'Threatening a player',
        points: ['Pretending to hit, or threatening to hit, another player.', 'Serious or repeated cases can mean ejection.'],
        penalty: { either: '5 steps' },
      },
      {
        id: 'unsportsmanlike',
        title: 'Unsportsmanlike conduct',
        points: ['Insulting opponents.', 'Deliberately provoking players.', 'Disrespecting referees.', 'Deliberately slowing the game down.'],
        penalty: { either: 'Referee decides, based on how serious it is' },
      },
      {
        id: 'fighting',
        title: 'Fighting',
        points: ['Immediate ejection. League officials may add more discipline.'],
      },
      {
        id: 'intent-to-injure',
        title: 'Trying to hurt someone',
        points: [
          'Any deliberate attempt to hurt a player is an immediate ejection.',
          'Doing it again can mean suspension from more games, and referees and league officials may add more discipline.',
        ],
      },
    ],
  },
  {
    id: 'conduct',
    number: 14,
    title: 'Conduct and referees',
    rules: [
      {
        id: 'sportsmanship',
        title: 'Sportsmanship',
        points: [
          'Respect teammates, opponents and referees.',
          'Don’t disrupt the game on purpose, and follow the referee’s instructions.',
          'Safety comes before winning.',
        ],
      },
      {
        id: 'referee-authority',
        title: 'The referee’s call is final',
        points: [
          'Captains may politely ask for an explanation.',
          'No one restarts play until the referee signals.',
          'The referee may stop play any time safety needs it.',
        ],
      },
      {
        id: 'ejections',
        title: 'Ejections',
        lead: 'An ejected player can’t come back that game. A player can be ejected for:',
        points: ['Fighting.', 'Trying to hurt someone.', 'Repeated unsportsmanlike conduct.', 'Repeatedly arguing with referees.', 'Serious breaks of league rules.'],
      },
    ],
  },
  {
    id: 'stats',
    number: 15,
    title: 'Stats in the app',
    lead: 'Stats are separate from the rules of play. The extra QB on the sideline records them when he isn’t in a play. Yards are not tracked in the app yet; only counts are.',
    rules: [
      {
        id: 'stats-qb',
        title: 'Quarterback',
        points: [
          'Pass attempts, completions, incompletions and completion percentage.',
          'Passing yards and passing touchdowns.',
          'Interceptions thrown.',
          'QB runs, rushing yards and rushing touchdowns.',
          'Rollouts and rollout yards.',
          'Sacks taken, fumbles and fumbles lost.',
          'Passing and rushing first downs.',
        ],
      },
      {
        id: 'stats-receiver',
        title: 'Receiver / tight end',
        points: ['Targets and receptions.', 'Receiving yards and touchdowns.', 'Drops.', 'First-down catches.', 'Longest catch.'],
      },
      {
        id: 'stats-line',
        title: 'Offensive line / tight end',
        points: ['Sacks and pressures allowed.', 'Blocking penalties.', 'Successful blocks.', 'Targets, receptions, receiving yards and touchdowns.'],
      },
      {
        id: 'stats-defense',
        title: 'Defense',
        points: ['Sacks.', 'Interceptions.', 'Passes defended.', 'Forced fumbles and fumble recoveries.', 'Safeties.', 'Legal two-hand touches.'],
      },
      {
        id: 'stats-special',
        title: 'Special teams',
        points: ['Kickoff returns and return yards.', 'Punt returns and return yards.', 'Return touchdowns.', 'Touchbacks.', 'Onside kick recoveries.', 'Kicks and punts.'],
      },
      {
        id: 'stats-team',
        title: 'Team',
        points: ['Points and touchdowns.', 'Passing and rushing yards.', 'First downs.', 'Turnovers.', 'Penalties.', 'Sacks allowed.', 'Kickoff and punt return yards.'],
      },
      {
        id: 'fantasy-points',
        title: 'Stat points',
        lead: 'Each stat is worth stat points. The MVP race ranks players by stat points per game. Stats not listed here are worth 0.',
        points: [
          'Touchdown (receiving or return): +6.',
          'QB rushing touchdown: +6.',
          'Passing touchdown: +4.',
          'Interception: +3.',
          'Pick six: +3.',
          'Catch: +1.',
          'Successful block: +1.',
          'Drop: −1.',
          'Interception thrown: −2.',
          'Fumble: −2.',
        ],
      },
      {
        id: 'statistician',
        title: 'Keeping stats',
        points: [
          'The backup QB records his team’s stats, after every play.',
          'Stats must match what actually happened.',
          'The statistician can’t overrule the referee.',
          'Disputed stats get checked with the referee or a league official.',
        ],
      },
    ],
  },
  {
    id: 'general',
    number: 16,
    title: 'General',
    rules: [
      {
        id: 'general-rules',
        title: 'Always',
        points: [
          'Every player follows this rulebook.',
          'No using an unclear rule on purpose to get an unfair edge.',
          'Anything this rulebook doesn’t cover, the referee decides.',
          'Permanent rule changes must be shared with all four teams.',
          'Player safety comes before finishing a play.',
        ],
      },
    ],
  },
]

const ruleText = (r: Rule) => [r.title, r.lead ?? '', ...r.points, r.penalty?.defense ?? '', r.penalty?.offense ?? '', r.penalty?.either ?? ''].join(' ').toLowerCase()

/** Sections with only the rules that contain every word of the search (any order, any case).
 *  A section's own title also matches, which keeps all its rules. Empty search: the whole book. */
export function searchRules(query: string): Section[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return RULEBOOK
  const out: Section[] = []
  for (const s of RULEBOOK) {
    const head = `${s.title} ${s.lead ?? ''}`.toLowerCase()
    const rules = s.rules.filter((r) => {
      const text = `${head} ${ruleText(r)}`
      return words.every((w) => text.includes(w))
    })
    if (rules.length) out.push({ ...s, rules })
  }
  return out
}
