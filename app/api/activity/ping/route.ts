import { NextResponse } from 'next/server'
import { detectDeviceType, getClientIp, logUserActivity } from '@/lib/activity'

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

    await logUserActivity({
      version: 1,
      event: 'heartbeat',
      role: role as 'student' | 'parent',
      userId,
      fullName,
      adminId,
      group: String(body?.group || '').trim() || null,
      sessionId,
      loginAt: String(body?.loginAt || '').trim() || undefined,
      lastSeenAt: nowIso,
      deviceType: detectDeviceType(userAgent),
      userAgent,
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
