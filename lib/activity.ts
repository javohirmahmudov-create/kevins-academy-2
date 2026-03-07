import prisma from '@/lib/prisma'

export type ActivityEventType = 'login' | 'heartbeat' | 'logout'
export type ActivityRole = 'student' | 'parent'

export interface ActivityPayload {
  version: 1
  event: ActivityEventType
  role: ActivityRole
  userId: string
  fullName: string
  adminId: number | null
  group?: string | null
  sessionId: string
  loginAt?: string
  lastSeenAt?: string
  logoutAt?: string
  durationSeconds?: number
  deviceType?: string
  userAgent?: string
  ipAddress?: string
}

export function detectDeviceType(userAgent: string): string {
  const normalized = String(userAgent || '').toLowerCase()
  if (!normalized) return 'unknown'
  if (/ipad|tablet/.test(normalized)) return 'tablet'
  if (/android|iphone|ipod|mobile/.test(normalized)) return 'mobile'
  return 'desktop'
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const realIp = request.headers.get('x-real-ip') || ''
  if (forwarded) return forwarded.split(',')[0]?.trim() || ''
  return realIp.trim()
}

export async function logUserActivity(payload: ActivityPayload): Promise<void> {
  const notificationLogDelegate = (prisma as any).notificationLog
  if (!notificationLogDelegate?.create) return

  await notificationLogDelegate.create({
    data: {
      channel: 'activity-tracker',
      type: 'user_activity',
      status: payload.event,
      recipient: `${payload.role}:${payload.userId}`,
      adminId: payload.adminId,
      studentId: payload.role === 'student' ? Number(payload.userId) || null : null,
      message: JSON.stringify(payload),
    },
  })
}

export function parseActivityPayload(rawMessage: string): ActivityPayload | null {
  try {
    const parsed = JSON.parse(rawMessage)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.type === 'user_activity' || parsed.channel === 'activity-tracker') {
      return null
    }

    const event = String((parsed as { event?: string }).event || '')
    const role = String((parsed as { role?: string }).role || '')
    const userId = String((parsed as { userId?: string }).userId || '')
    const fullName = String((parsed as { fullName?: string }).fullName || '')
    const sessionId = String((parsed as { sessionId?: string }).sessionId || '')

    if (!event || !role || !userId || !fullName || !sessionId) return null
    if (!['login', 'heartbeat', 'logout'].includes(event)) return null
    if (!['student', 'parent'].includes(role)) return null

    return {
      version: 1,
      event: event as ActivityEventType,
      role: role as ActivityRole,
      userId,
      fullName,
      adminId: Number.isFinite(Number((parsed as { adminId?: number | string | null }).adminId))
        ? Number((parsed as { adminId?: number | string | null }).adminId)
        : null,
      group: String((parsed as { group?: string | null }).group || '').trim() || null,
      sessionId,
      loginAt: String((parsed as { loginAt?: string }).loginAt || '').trim() || undefined,
      lastSeenAt: String((parsed as { lastSeenAt?: string }).lastSeenAt || '').trim() || undefined,
      logoutAt: String((parsed as { logoutAt?: string }).logoutAt || '').trim() || undefined,
      durationSeconds: Number.isFinite(Number((parsed as { durationSeconds?: number }).durationSeconds))
        ? Number((parsed as { durationSeconds?: number }).durationSeconds)
        : undefined,
      deviceType: String((parsed as { deviceType?: string }).deviceType || '').trim() || undefined,
      userAgent: String((parsed as { userAgent?: string }).userAgent || '').trim() || undefined,
      ipAddress: String((parsed as { ipAddress?: string }).ipAddress || '').trim() || undefined,
    }
  } catch {
    return null
  }
}