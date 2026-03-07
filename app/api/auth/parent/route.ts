import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { unpackParent } from '@/lib/utils/parentAuth'
import { detectDeviceType, getClientIp, logUserActivity } from '@/lib/activity'

const PARENT_LEGACY_SELECT = {
  id: true,
  adminId: true,
  fullName: true,
  email: true,
  phone: true,
  createdAt: true,
} as const

function parsePositiveIntIds(values: unknown[]): number[] {
  const unique = new Set<number>()

  for (const value of values) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) continue
    const normalized = Math.trunc(numeric)
    if (normalized <= 0) continue
    unique.add(normalized)
  }

  return Array.from(unique)
}

function buildParentActivityGroup(student?: { fullName: string; group: string | null } | null): string | null {
  if (!student) return null
  const fullName = String(student.fullName || '').trim()
  const group = String(student.group || '').trim()
  if (!fullName && !group) return null
  if (fullName && group) return `${fullName} • ${group}`
  return fullName || group || null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '').trim()
    const normalizedUsername = username.toLowerCase()

    if (!username || !password) {
      return NextResponse.json({ reason: 'missing_credentials' }, { status: 400 })
    }

    const parents = await prisma.parent.findMany({
      select: PARENT_LEGACY_SELECT,
      orderBy: { createdAt: 'desc' }
    })
    const expanded = Array.isArray(parents) ? parents.map(unpackParent) : []

    const matched = expanded.find((parent: any) => {
      const parentUsername = String(parent?.username || '').trim().toLowerCase()
      const parentPassword = String(parent?.password || '').trim()
      const emailAsUsername = String(parent?.email || '').trim().toLowerCase()
      const phoneAsPassword = String(parent?.phone || '').trim()

      const metadataMatch = parentUsername === normalizedUsername && parentPassword === password
      const legacyFallbackMatch = emailAsUsername === normalizedUsername && phoneAsPassword === password

      return metadataMatch || legacyFallbackMatch
    })

    if (!matched) {
      return NextResponse.json({ reason: 'not_found' }, { status: 401 })
    }

    const userAgent = request.headers.get('user-agent') || ''
    const sessionId = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    const resolvedAdminId = Number.isFinite(Number(matched.adminId)) ? Number(matched.adminId) : null

    const rawStudentIds = Array.isArray((matched as any).studentIds)
      ? (matched as any).studentIds
      : [matched.studentId]
    const normalizedStudentIds = parsePositiveIntIds(rawStudentIds)
    const studentsWhere: any = { id: { in: normalizedStudentIds } }
    if (resolvedAdminId) {
      studentsWhere.adminId = resolvedAdminId
    }

    const linkedStudents = normalizedStudentIds.length > 0
      ? await prisma.student.findMany({
          where: studentsWhere,
          select: { id: true, fullName: true, group: true },
        })
      : []

    const studentMap = new Map(linkedStudents.map((student) => [student.id, student]))
    const primaryMatchedStudentId = Number.isFinite(Number(matched.studentId)) ? Number(matched.studentId) : null
    const primaryStudent = (primaryMatchedStudentId ? studentMap.get(primaryMatchedStudentId) : null) || linkedStudents[0] || null
    const activityGroup = buildParentActivityGroup(primaryStudent)

    await logUserActivity({
      version: 1,
      event: 'login',
      role: 'parent',
      userId: String(matched.id),
      fullName: String(matched.fullName || 'Parent'),
      adminId: resolvedAdminId,
      group: activityGroup,
      sessionId,
      loginAt: nowIso,
      lastSeenAt: nowIso,
      deviceType: detectDeviceType(userAgent),
      userAgent,
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({
      id: String(matched.id),
      fullName: matched.fullName,
      username: matched.username || matched.email || '',
      email: matched.email || '',
      phone: matched.phone || '',
      studentId: matched.studentId || '',
      studentIds: Array.isArray((matched as any).studentIds) ? (matched as any).studentIds : (matched.studentId ? [matched.studentId] : []),
      primaryStudentName: primaryStudent?.fullName || '',
      primaryStudentGroup: primaryStudent?.group || '',
      activityGroup: activityGroup || '',
      adminId: matched.adminId ? String(matched.adminId) : 'system',
      role: 'parent',
      activitySessionId: sessionId,
      activityLoginAt: nowIso,
    })
  } catch (error) {
    return NextResponse.json({ reason: 'error' }, { status: 500 })
  }
}
