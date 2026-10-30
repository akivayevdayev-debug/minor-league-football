/*
 * The ONLY file that imports Phosphor. Screens ask for an icon by name.
 * Add a name here when a phase needs it (frontend plan, section 4); swapping icon packs is a one-file change.
 */
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  CaretDownIcon,
  CaretRightIcon,
  CrownIcon,
  DeviceMobileIcon,
  HouseIcon,
  InfoIcon,
  LightningIcon,
  LockIcon,
  ShieldCheckIcon,
  TargetIcon,
  TrophyIcon,
  CameraIcon,
  UserCircleIcon,
  CaretLeftIcon,
  ClockCounterClockwiseIcon,
  DotsThreeIcon,
  ExportIcon,
  EyeIcon,
  EyeSlashIcon,
  FootballIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  RankingIcon,
  SignOutIcon,
  UserPlusIcon,
  UsersThreeIcon,
  WarningCircleIcon,
  WifiSlashIcon,
  XIcon,
  SunIcon,
  CityIcon,
  PawPrintIcon,
  PlayIcon,
  PauseIcon,
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  MinusIcon,
  ChartBarIcon,
  TimerIcon,
  FlagCheckeredIcon,
  CheckIcon,
  TrendUpIcon,
  ClipboardTextIcon,
  FireIcon,
  StarIcon,
  BroadcastIcon,
  UserListIcon,
  KeyboardIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'

const icons = {
  standings: RankingIcon,
  games: FootballIcon,
  players: UsersThreeIcon,
  schedule: CalendarBlankIcon,
  edit: PencilSimpleIcon,
  settings: GearSixIcon,
  menu: DotsThreeIcon,
  export: ExportIcon,
  show: EyeIcon,
  hide: EyeSlashIcon,
  'add-guest': UserPlusIcon,
  'sign-out': SignOutIcon,
  close: XIcon,
  back: CaretLeftIcon,
  search: MagnifyingGlassIcon,
  add: PlusIcon,
  error: WarningCircleIcon,
  offline: WifiSlashIcon,
  history: ClockCounterClockwiseIcon,
  home: HouseIcon,
  me: UserCircleIcon,
  chevron: CaretRightIcon,
  'caret-down': CaretDownIcon,
  forward: ArrowRightIcon,
  trophy: TrophyIcon,
  camera: CameraIcon,
  crown: CrownIcon,
  lock: LockIcon,
  device: DeviceMobileIcon,
  info: InfoIcon,
  target: TargetIcon,
  bolt: LightningIcon,
  shield: ShieldCheckIcon,
  'calendar-check': CalendarCheckIcon,
  sun: SunIcon,
  city: CityIcon,
  paw: PawPrintIcon,
  play: PlayIcon,
  pause: PauseIcon,
  undo: ArrowCounterClockwiseIcon,
  trade: ArrowsLeftRightIcon,
  minus: MinusIcon,
  chart: ChartBarIcon,
  clock: TimerIcon,
  finish: FlagCheckeredIcon,
  check: CheckIcon,
  trend: TrendUpIcon,
  stats: ClipboardTextIcon,
  hot: FireIcon,
  star: StarIcon,
  live: BroadcastIcon,
  roster: UserListIcon,
  type: KeyboardIcon,
} satisfies Record<string, PhosphorIcon>

export type IconName = keyof typeof icons

type Size = 'xs' | 'sm' | 'md' | 'lg'

interface IconProps {
  name: IconName
  size?: Size
  /** Fill weight is for the active tab only. */
  filled?: boolean
  /** Give a label only when the icon stands alone and carries meaning. Otherwise it is hidden from screen readers. */
  label?: string
  className?: string
}

export function Icon({ name, size = 'md', filled = false, label, className }: IconProps) {
  const Glyph = icons[name]
  return (
    <Glyph
      style={{ width: `var(--icon-${size})`, height: `var(--icon-${size})`, flexShrink: 0 }}
      weight={filled ? 'fill' : 'regular'}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={className}
    />
  )
}
