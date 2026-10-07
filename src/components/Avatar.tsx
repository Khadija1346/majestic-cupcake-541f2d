import type { Avatar as A } from '@/lib/types'

export const OUTFITS = ['#d4552a', '#2f3f9e', '#1f8a5b', '#f2b632', '#a3322c', '#7b3fa0', '#120f2e', '#f7e3b0']
export const SKINS = ['#3b2414', '#5a3620', '#6b4226', '#8a5a36', '#a8754a']

/** SVG portrait that mirrors the in-town sprite. */
export function AvatarBadge({ avatar, size = 56 }: { avatar: A; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden className="shrink-0 rounded-2xl bg-indigo ring-2 ring-gold/40">
      <circle cx="30" cy="30" r="28" fill="#2f3f9e" opacity=".35" />
      <rect x="15" y="34" width="30" height="26" rx="9" fill={avatar.outfit} />
      <circle cx="22" cy="42" r="2" fill="#fff" opacity=".4" />
      <circle cx="38" cy="46" r="2" fill="#fff" opacity=".4" />
      <circle cx="30" cy="25" r="11" fill={avatar.skin} />
      <rect x="24" y="23" width="2.5" height="3" fill="#120f2e" />
      <rect x="33.5" y="23" width="2.5" height="3" fill="#120f2e" />
      {avatar.cap === 'fila' && <path d="M18 18 L42 18 L45 7 L22 9 Z" fill={avatar.outfit} />}
      {avatar.cap === 'gele' && <ellipse cx="30" cy="12" rx="17" ry="9" fill={avatar.outfit} transform="rotate(-10 30 12)" />}
      {avatar.cap === 'none' && <path d="M19 22 A11 11 0 0 1 41 22 Z" fill="#120f2e" />}
    </svg>
  )
}
