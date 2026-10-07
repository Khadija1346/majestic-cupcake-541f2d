import { getUser } from '@netlify/identity'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/index'
import { modActions, staff } from '../../db/schema'

export type StaffRole = 'admin' | 'moderator' | 'none'

/**
 * Who is signed in to the Moderator Office (Netlify Identity) and what they
 * may do. Roles come from the Game Administrator only:
 *  - admin: Identity role "admin" (set in Netlify) or an email in GARRI_ADMIN_EMAILS
 *  - moderator: Identity role "moderator", or a grant the admin approved in-app
 */
export async function currentStaff() {
  const user = await getUser()
  if (!user) return null
  const email = (user.email ?? '').toLowerCase()
  const envAdmins = (process.env.GARRI_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const roles = user.roles ?? []
  const [grant] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.identityUserId, user.id), isNull(staff.revokedAt)))
    .limit(1)
  const isAdmin = roles.includes('admin') || (!!email && envAdmins.includes(email)) || grant?.role === 'admin'
  const isMod = isAdmin || roles.includes('moderator') || !!grant
  const role: StaffRole = isAdmin ? 'admin' : isMod ? 'moderator' : 'none'
  return { id: user.id, email, name: user.name ?? null, role }
}

export async function requireModerator() {
  const s = await currentStaff()
  if (!s) throw new Error('Sign in to the Moderator Office first.')
  if (s.role === 'none') throw new Error('Moderator access is granted by the game administrator.')
  return s
}

export async function requireAdmin() {
  const s = await requireModerator()
  if (s.role !== 'admin') throw new Error('Only the game administrator can do this.')
  return s
}

export async function logAction(actor: string, action: string, targetType: string, targetId: string, note?: string | null) {
  await db.insert(modActions).values({ actor, action, targetType, targetId, note: note ?? null })
}
