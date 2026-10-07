import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getCookie, getRequestHeader, setCookie } from '@tanstack/react-start/server'
import { db } from '../../db/index'
import { sessions } from '../../db/schema'

const COOKIE = 'garri_citizen'
const YEAR = 60 * 60 * 24 * 365

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

/** Hashes identifiers (IP, device) so raw values are never stored. */
export function fingerprint(v: string | null | undefined) {
  if (!v) return null
  return sha256(`garri:${process.env.GARRI_HASH_SALT ?? 'rise-of-the-town'}:${v}`)
}

export function clientIpHash() {
  const ip =
    getRequestHeader('x-nf-client-connection-ip') ??
    getRequestHeader('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  return fingerprint(ip)
}

export function randomCode(len: number) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(len), (b) => alphabet[b % alphabet.length]).join('')
}

export async function startSession(citizenId: string) {
  const token = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({ tokenHash: sha256(token), citizenId })
  setCookie(COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: YEAR })
}

export async function endSession() {
  const token = getCookie(COOKIE)
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)))
  setCookie(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
}

/** The signed-in Citizen's id, or null. The cookie is httpOnly — scripts can't read it. */
export async function sessionCitizenId() {
  const token = getCookie(COOKIE)
  if (!token) return null
  const [row] = await db.select({ citizenId: sessions.citizenId }).from(sessions).where(eq(sessions.tokenHash, sha256(token))).limit(1)
  return row?.citizenId ?? null
}

export async function requireCitizenId() {
  const id = await sessionCitizenId()
  if (!id) throw new Error('Your Citizen session has ended. Re-enter the town to continue.')
  return id
}
