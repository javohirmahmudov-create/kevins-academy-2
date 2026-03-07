import { NextResponse } from 'next/server'
import { detectDeviceType, getClientIp, logUserActivity } from '@/lib/activity'

function resolveDurationSeconds(loginAt?: string): number | undefined {
  if (!loginAt) return undefined
  const start = new Date(loginAt)
  if (Number.isNaN(start.getTime())) return undefined
  const diff = Math.floor((Date.now() - start.getTime()) / 1000)
  if (!Number.isFinite(diff) || diff < 0) return undefined
  return diff
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const role = String(body?.role || '')
    const userId = String(body?.userId || '').trim()
    const fullName = String(body?.fullName || '').trim()
    const sessionId = String(body?.sessionId || '').trim()
    const adminIdRaw = Number(body?.adminId)
    const adminId = Number.isFinite(adminIdRaw) && adminIdRaw > 0 ? adminIdRaw : null

    if (!['student', 'parent'].includes(role) || !userId || !fullName || !sessionId) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
    }

    const userAgent = request.headers.get('user-agent') || ''
    const nowIso = new Date().toISOString()
    const loginAt = String(body?.loginAt || '').trim() || undefined

    await logUserActivity({
      version: 1,
      event: 'logout',
      role: role as 'student' | 'parent',
      userId,
      fullName,
      adminId,
      group: String(body?.group || '').trim() || null,
      sessionId,
      loginAt,
      lastSeenAt: nowIso,
      logoutAt: nowIso,
      durationSeconds: resolveDurationSeconds(loginAt),
      deviceType: detectDeviceType(userAgent),
      userAgent,
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
