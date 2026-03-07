import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { unpackParent } from '@/lib/utils/parentAuth'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

const DISCONNECTED_ALERT_DISMISS_TYPE = 'disconnected_parent_alert_dismissed'

function toValidDate(value: unknown) {
  const parsed = new Date(String(value || ''))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeLevel(raw?: string | null) {
  const value = String(raw || '').trim().toLowerCase()
  if (value.includes('advanced')) return 'Advanced'
  if (value.includes('intermediate')) return 'Intermediate'
  if (value.includes('elementary')) return 'Elementary'
  return 'Beginner'
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope is required' }, { status: 400 })
    }

    const parentDelegate = (prisma as any).parent
    const notificationLogDelegate = (prisma as any).notificationLog
    if (!parentDelegate) {
      return NextResponse.json({ count: 0, rows: [] })
    }

    const parentRows = await parentDelegate.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
    })

    const unpacked = (Array.isArray(parentRows) ? parentRows : []).map((parent: any) => {
      const parsed = unpackParent(parent) as any
      return {
        ...parent,
        ...parsed,
      }
    })

    const parents = unpacked.filter((parent: any) => String(parent?.botStatus || '').toUpperCase() === 'DISCONNECTED')

    const sortedParents = parents.sort((a: any, b: any) => {
      const aTime = new Date(a?.botDisconnectedAt || a?.botLastCheckedAt || a?.createdAt || 0).getTime()
      const bTime = new Date(b?.botDisconnectedAt || b?.botLastCheckedAt || b?.createdAt || 0).getTime()
      return bTime - aTime
    })

    const dismissedLogRows = notificationLogDelegate?.findMany
      ? await notificationLogDelegate.findMany({
          where: {
            adminId,
            type: DISCONNECTED_ALERT_DISMISS_TYPE,
          },
          orderBy: { createdAt: 'desc' },
          take: 3000,
          select: { recipient: true, createdAt: true },
        })
      : []

    const dismissedAtByParentId = new Map<number, Date>()
    for (const row of (dismissedLogRows as any[])) {
      const parentId = Number(String(row?.recipient || '').trim())
      if (!Number.isFinite(parentId) || parentId <= 0) continue
      if (dismissedAtByParentId.has(parentId)) continue
      const createdAt = toValidDate(row?.createdAt)
      if (!createdAt) continue
      dismissedAtByParentId.set(parentId, createdAt)
    }

    const unresolvedParents = sortedParents.filter((parent: any) => {
      const parentId = Number(parent?.id || 0)
      if (!Number.isFinite(parentId) || parentId <= 0) return false

      const disconnectedAt = toValidDate(parent?.botDisconnectedAt || parent?.botLastCheckedAt || parent?.createdAt)
      const dismissedAt = dismissedAtByParentId.get(parentId)
      if (!dismissedAt) return true
      if (!disconnectedAt) return false
      return disconnectedAt.getTime() > dismissedAt.getTime()
    })

    const studentIds = Array.from(
      new Set(
        unresolvedParents
          .map((item) => Number(item?.studentId || 0))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    )

    const students = studentIds.length
      ? await prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, fullName: true, group: true },
        })
      : []

    const groupNames = Array.from(new Set(students.map((student) => String(student.group || '').trim()).filter(Boolean)))
    const groups = groupNames.length
      ? await prisma.group.findMany({
          where: { name: { in: groupNames } },
          select: { name: true, level: true },
        })
      : []

    const studentById = new Map(students.map((student) => [student.id, student]))
    const groupLevelByName = new Map(groups.map((group) => [String(group.name || '').trim(), normalizeLevel(group.level)]))

    const rows = unresolvedParents.map((parent) => {
      const studentId = Number(parent?.studentId || 0)
      const student = studentById.get(studentId)
      const level = student?.group ? (groupLevelByName.get(String(student.group).trim()) || 'Beginner') : 'Beginner'
      const parentPhone = String(parent?.phone || '').trim()

      return {
        parentId: parent.id,
        parentName: String(parent.fullName || 'Noma’lum ota-ona'),
        parentPhone,
        studentId: student?.id || null,
        studentName: String(student?.fullName || 'Noma’lum o‘quvchi'),
        level,
        statusText: 'Bot o‘chirildi yoki bloklandi',
        disconnectedAt: parent.botDisconnectedAt || parent.botLastCheckedAt || parent.createdAt,
        lastError: parent.botLastError || '',
      }
    })

    return NextResponse.json({
      count: rows.length,
      rows,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope is required' }, { status: 400 })
    }

    const notificationLogDelegate = (prisma as any).notificationLog
    if (!notificationLogDelegate?.create) {
      return NextResponse.json({ error: 'Notification log unavailable' }, { status: 503 })
    }

    const body = await request.json().catch(() => null)
    const parentIdsRaw = Array.isArray(body?.parentIds)
      ? body.parentIds
      : (body?.parentId !== undefined ? [body.parentId] : [])

    const parentIds = Array.from(
      new Set(
        parentIdsRaw
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    )

    if (parentIds.length === 0) {
      return NextResponse.json({ error: 'parentId or parentIds required' }, { status: 400 })
    }

    await Promise.all(
      parentIds.map((parentId) =>
        notificationLogDelegate.create({
          data: {
            channel: 'web',
            type: DISCONNECTED_ALERT_DISMISS_TYPE,
            status: 'dismissed',
            recipient: String(parentId),
            adminId,
            message: JSON.stringify({ parentId, dismissedAt: new Date().toISOString() }),
          },
        })
      )
    )

    return NextResponse.json({ ok: true, dismissedCount: parentIds.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}
