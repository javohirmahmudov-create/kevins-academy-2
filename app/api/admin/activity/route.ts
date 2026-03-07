import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { parseActivityPayload } from '@/lib/activity'
import { unpackParent } from '@/lib/utils/parentAuth'

type ActivityRow = {
  id: number
  role: 'student' | 'parent'
  userId: string
  fullName: string
  group: string
  deviceType: string
  ipAddress: string
  sessionId: string
  loginAt: string
  lastSeenAt: string
  durationSeconds: number | null
  online: boolean
}

type LatestUserState = {
  key: string
  role: 'student' | 'parent'
  userId: string
  fullName: string
  group: string
  lastSeenAt: string
  event: 'login' | 'heartbeat' | 'logout'
  online: boolean
}

type LoginRankRow = {
  key: string
  role: 'student' | 'parent'
  userId: string
  fullName: string
  group: string
  loginCount: number
  lastLoginAt: string
}

type ParsedLogEntry = {
  id: number
  payload: NonNullable<ReturnType<typeof parseActivityPayload>>
  createdAtIso: string
  effectiveTimeIso: string
}

const ONLINE_MS = 5 * 60 * 1000
const INACTIVE_MS = 3 * 24 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

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

function normalizeActivityGroup(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return '-'

  const chunks = value
    .split('•')
    .map((item) => item.trim())
    .filter(Boolean)

  if (chunks.length >= 2) {
    return chunks[chunks.length - 1]
  }

  return value
}

function buildParentActivityGroup(student?: { fullName: string; group: string | null } | null): string {
  if (!student) return '-'
  return normalizeActivityGroup(student.group)
}

function toIsoOrEmpty(value?: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString()
}

function isWithinRange(valueIso: string, from?: string | null, to?: string | null): boolean {
  if (!valueIso) return false
  const value = new Date(valueIso).getTime()
  if (!Number.isFinite(value)) return false
  const fromTs = from ? new Date(from).getTime() : null
  const toTs = to ? new Date(to).getTime() : null
  if (fromTs && Number.isFinite(fromTs) && value < fromTs) return false
  if (toTs && Number.isFinite(toTs) && value > toTs + (24 * 60 * 60 * 1000 - 1)) return false
  return true
}

function matchesCommonFilters(
  row: { role: 'student' | 'parent'; group: string; fullName: string; userId: string; loginAt: string },
  input: { from?: string | null; to?: string | null; roleFilter?: string; groupFilter?: string; searchText?: string }
): boolean {
  if (input.roleFilter && row.role !== input.roleFilter) return false
  if (input.groupFilter && row.group !== input.groupFilter) return false
  if (input.searchText && !`${row.fullName} ${row.userId}`.toLowerCase().includes(input.searchText)) return false
  if (!isWithinRange(row.loginAt, input.from, input.to)) return false
  return true
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const roleFilter = String(searchParams.get('role') || '').trim()
    const groupFilter = String(searchParams.get('group') || '').trim()
    const searchText = String(searchParams.get('search') || '').trim().toLowerCase()

    const notificationLogDelegate = (prisma as any).notificationLog
    if (!notificationLogDelegate?.findMany) {
      return NextResponse.json({
        summary: {
          totalUsers: 0,
          onlineNow: 0,
          loginsToday: 0,
          inactiveCount: 0,
          parentLoginRate: 0,
        },
        rows: [],
        groups: [],
        inactiveUsers: [],
        aiReport: [
          'Kevin AI haftalik diagnostika: activity log jadvali hozircha mavjud emas.',
          'Migration va Prisma generate bajarilgach, to‘liq hisobot paydo bo‘ladi.',
        ],
      })
    }

    const logRows = await notificationLogDelegate.findMany({
      where: {
        adminId,
        type: 'user_activity',
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const parsed = (logRows as any[])
      .map((row: any): ParsedLogEntry | null => {
        const payload = parseActivityPayload(String(row.message || ''))
        if (!payload) return null
        const createdAtIso = row.createdAt.toISOString()
        const effectiveTime = payload.lastSeenAt || payload.loginAt || payload.logoutAt || createdAtIso

        return {
          id: row.id,
          payload,
          createdAtIso,
          effectiveTimeIso: toIsoOrEmpty(effectiveTime) || createdAtIso,
        }
      })
      .filter((item: ParsedLogEntry | null): item is ParsedLogEntry => Boolean(item))

    const parentActivityGroupById = new Map<string, string>()
    const parentIds = parsePositiveIntIds(
      parsed
        .filter((entry) => entry.payload.role === 'parent')
        .map((entry) => entry.payload.userId)
    )

    if (parentIds.length > 0) {
      const parentRows = await prisma.parent.findMany({
        where: {
          adminId,
          id: { in: parentIds },
        },
        select: {
          id: true,
          phone: true,
        },
      })

      const unpackedParents = parentRows.map((parent) => ({
        id: parent.id,
        payload: unpackParent(parent) as any,
      }))

      const allStudentIds = parsePositiveIntIds(
        unpackedParents.flatMap((parent) => {
          const studentIds = Array.isArray(parent.payload?.studentIds) ? parent.payload.studentIds : []
          return [parent.payload?.studentId, ...studentIds]
        })
      )

      const studentRows = allStudentIds.length > 0
        ? await prisma.student.findMany({
            where: {
              adminId,
              id: { in: allStudentIds },
            },
            select: {
              id: true,
              fullName: true,
              group: true,
            },
          })
        : []

      const studentById = new Map(studentRows.map((student) => [student.id, student]))

      for (const parent of unpackedParents) {
        const orderedStudentIds = parsePositiveIntIds([
          parent.payload?.studentId,
          ...(Array.isArray(parent.payload?.studentIds) ? parent.payload.studentIds : []),
        ])

        const primaryStudent = orderedStudentIds
          .map((studentId) => studentById.get(studentId))
          .find((student): student is NonNullable<typeof student> => Boolean(student)) || null

        const groupName = buildParentActivityGroup(primaryStudent)
        if (groupName !== '-') {
          parentActivityGroupById.set(String(parent.id), groupName)
        }
      }
    }

    const resolveActivityGroup = (payload: ParsedLogEntry['payload']) => {
      const explicitGroup = normalizeActivityGroup(payload.group)
      if (explicitGroup !== '-') return explicitGroup
      if (payload.role === 'parent') {
        return normalizeActivityGroup(parentActivityGroupById.get(String(payload.userId)) || '-')
      }
      return '-'
    }

    const latestMap = new Map<string, LatestUserState>()
    parsed.forEach((item: ParsedLogEntry) => {
      const key = `${item.payload.role}:${item.payload.userId}`
      if (latestMap.has(key)) return
      const seenAt = toIsoOrEmpty(item.payload.lastSeenAt || item.payload.logoutAt || item.payload.loginAt) || item.createdAtIso
      const seenTs = new Date(seenAt).getTime()
      const event = item.payload.event
      const online = event !== 'logout' && Date.now() - seenTs <= ONLINE_MS
      latestMap.set(key, {
        key,
        role: item.payload.role,
        userId: item.payload.userId,
        fullName: item.payload.fullName,
        group: resolveActivityGroup(item.payload),
        lastSeenAt: seenAt,
        event,
        online,
      })
    })

    const logoutBySession = new Map<string, number>()
    parsed.forEach((item: ParsedLogEntry) => {
      if (item.payload.event !== 'logout') return
      if (!item.payload.sessionId) return
      if (logoutBySession.has(item.payload.sessionId)) return
      const duration = Number(item.payload.durationSeconds)
      logoutBySession.set(item.payload.sessionId, Number.isFinite(duration) && duration >= 0 ? duration : 0)
    })

    const loginRows = parsed
      .filter((item: ParsedLogEntry) => item.payload.event === 'login')
      .map((item: ParsedLogEntry) => {
        const key = `${item.payload.role}:${item.payload.userId}`
        const latest = latestMap.get(key)
        const loginAt = toIsoOrEmpty(item.payload.loginAt || item.createdAtIso) || item.createdAtIso
        const lastSeenAt = latest?.lastSeenAt || loginAt
        return {
          id: item.id,
          role: item.payload.role,
          userId: item.payload.userId,
          fullName: item.payload.fullName,
          group: resolveActivityGroup(item.payload),
          deviceType: String(item.payload.deviceType || 'unknown'),
          ipAddress: String(item.payload.ipAddress || '-'),
          sessionId: item.payload.sessionId,
          loginAt,
          lastSeenAt,
          durationSeconds: logoutBySession.get(item.payload.sessionId) ?? null,
          online: Boolean(latest?.online),
        } satisfies ActivityRow
      })

    const filteredRows = loginRows.filter((row: ActivityRow) => {
      return matchesCommonFilters(row, { from, to, roleFilter, groupFilter, searchText })
    })

    const latestUsers = Array.from(latestMap.values())
      .filter((row) => {
        if (roleFilter && row.role !== roleFilter) return false
        if (groupFilter && row.group !== groupFilter) return false
        if (searchText && !`${row.fullName} ${row.userId}`.toLowerCase().includes(searchText)) return false
        return true
      })

    const now = Date.now()
    const inactiveUsers = latestUsers.filter((user) => {
      const seen = new Date(user.lastSeenAt).getTime()
      return Number.isFinite(seen) && now - seen >= INACTIVE_MS
    })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartTs = todayStart.getTime()

    const loginsToday = loginRows.filter((row) => {
      const ts = new Date(row.loginAt).getTime()
      return Number.isFinite(ts) && ts >= todayStartTs
    }).length

    const filteredTodayRows = filteredRows
      .filter((row) => {
        const ts = new Date(row.loginAt).getTime()
        return Number.isFinite(ts) && ts >= todayStartTs
      })
      .sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime())

    const todayLoggedKeys = new Set(filteredTodayRows.map((row) => `${row.role}:${row.userId}`))
    const notLoggedToday = latestUsers
      .filter((user) => !todayLoggedKeys.has(user.key))
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())

    const weekAgoTs = Date.now() - WEEK_MS
    const parentLoginIds = new Set(
      loginRows
        .filter((row: ActivityRow) => row.role === 'parent' && new Date(row.loginAt).getTime() >= weekAgoTs)
        .map((row: ActivityRow) => row.userId)
    )

    const totalParents = await prisma.parent.count({ where: { adminId } })
    const parentLoginRate = totalParents > 0 ? Math.round((parentLoginIds.size / totalParents) * 100) : 0

    const inactiveStudentsByGroup: Record<string, number> = {}
    inactiveUsers
      .filter((user) => user.role === 'student')
      .forEach((user) => {
        const key = user.group || '-'
        inactiveStudentsByGroup[key] = (inactiveStudentsByGroup[key] || 0) + 1
      })

    const topInactiveGroups = Object.entries(inactiveStudentsByGroup)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([group, count]) => `${group} (${count} ta)`)

    const preIeltsInactiveCount = inactiveUsers.filter((user) => {
      if (user.role !== 'student') return false
      return String(user.group || '').toLowerCase().includes('pre-ielts')
    }).length

    const rankingSource = loginRows.filter((row: ActivityRow) =>
      matchesCommonFilters(row, { from, to, groupFilter, searchText })
    )

    const rankingMap = new Map<string, LoginRankRow>()
    rankingSource.forEach((row: ActivityRow) => {
      const key = `${row.role}:${row.userId}`
      const existing = rankingMap.get(key)
      if (!existing) {
        rankingMap.set(key, {
          key,
          role: row.role,
          userId: row.userId,
          fullName: row.fullName,
          group: row.group,
          loginCount: 1,
          lastLoginAt: row.loginAt,
        })
        return
      }

      existing.loginCount += 1
      if (new Date(row.loginAt).getTime() > new Date(existing.lastLoginAt).getTime()) {
        existing.lastLoginAt = row.loginAt
      }
      rankingMap.set(key, existing)
    })

    const rankingRows = Array.from(rankingMap.values()).sort((a, b) => {
      if (b.loginCount !== a.loginCount) return b.loginCount - a.loginCount
      return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime()
    })

    const parentRankings = rankingRows.filter((row) => row.role === 'parent').slice(0, 50)
    const studentRankings = rankingRows.filter((row) => row.role === 'student').slice(0, 50)

    const aiReport = [
      `Mr. Kevin, bu hafta ota-onalarning ${parentLoginRate}% saytga kirdi.`,
      preIeltsInactiveCount > 0
        ? `Pre-IELTS guruhida ${preIeltsInactiveCount} ta o‘quvchi 3+ kundan beri tizimga kirmagan.`
        : 'Pre-IELTS guruhida 3+ kun nofaol o‘quvchi aniqlanmadi.',
      inactiveUsers.length > 0
        ? `Jami 3+ kun nofaol foydalanuvchilar: ${inactiveUsers.length} ta.`
        : 'Umumiy nofaol foydalanuvchi yo‘q.',
      topInactiveGroups.length > 0
        ? `Eng nofaol guruhlar: ${topInactiveGroups.join(', ')}.`
        : 'Guruhlar bo‘yicha faollik barqaror.',
      inactiveUsers.length > 0
        ? 'Ularga ogohlantirish yuborilsinmi?'
        : 'Monitoring davom ettirilsin.',
    ]

    const groups = Array.from(
      new Set(
        loginRows
          .map((row: ActivityRow) => normalizeActivityGroup(row.group))
          .filter((group: string) => group && group !== '-')
      )
    ).sort()

    return NextResponse.json({
      summary: {
        totalUsers: latestUsers.length,
        onlineNow: latestUsers.filter((row) => row.online).length,
        loginsToday,
        inactiveCount: inactiveUsers.length,
        parentLoginRate,
      },
      rows: filteredRows,
      groups,
      inactiveUsers,
      todayLogins: filteredTodayRows,
      notLoggedToday,
      rankings: {
        parents: parentRankings,
        students: studentRankings,
      },
      aiReport,
    })
  } catch (error) {
    console.error('activity monitor error:', error)
    return NextResponse.json({ error: 'Activity monitor load failed' }, { status: 500 })
  }
}
