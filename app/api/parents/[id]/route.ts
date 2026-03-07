import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { findTelegramChatIdByPhone, normalizePhoneForLinking, sendTelegramMessage } from '@/lib/telegram'

function cleanString(value: unknown) {
  return String(value || '').trim()
}

function parseStudentIds(input: unknown, fallbackStudentId?: unknown) {
  const fromArray = Array.isArray(input) ? input : []
  const fallback = cleanString(fallbackStudentId)
  const unique = new Set<string>()

  for (const item of fromArray) {
    const normalized = cleanString(item)
    if (!normalized) continue
    unique.add(normalized)
  }

  if (fallback) unique.add(fallback)
  return Array.from(unique)
}

async function resolveStudentName(studentId?: string) {
  const parsed = Number(studentId || '')
  if (!Number.isFinite(parsed) || parsed <= 0) return "o'quvchi"
  const student = await prisma.student.findUnique({ where: { id: parsed }, select: { fullName: true } })
  return student?.fullName || "o'quvchi"
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const body = await request.json()
    const existing = await prisma.parent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const existingMeta = decodeParentMetadata(existing.phone)
    const nextStudentIds = body.studentIds !== undefined || body.studentId !== undefined
      ? parseStudentIds(body.studentIds, body.studentId)
      : parseStudentIds(existingMeta?.studentIds, existingMeta?.studentId)
    const previousNormalizedPhone = normalizePhoneForLinking(existingMeta?.phone || existing.phone)
    const nextMetadata = {
      username: body.username !== undefined ? (body.username || undefined) : existingMeta?.username,
      password: body.password !== undefined ? (body.password || undefined) : existingMeta?.password,
      studentId: nextStudentIds[0] || undefined,
      studentIds: nextStudentIds,
      phone: body.phone !== undefined ? (body.phone || undefined) : (existingMeta?.phone ?? existing.phone ?? undefined),
      telegramChatId: existingMeta?.telegramChatId,
      botStatus: existingMeta?.botStatus,
      botDisconnectedAt: existingMeta?.botDisconnectedAt,
      botLastCheckedAt: existingMeta?.botLastCheckedAt,
      botLastError: existingMeta?.botLastError,
    }

    const nextNormalizedPhone = normalizePhoneForLinking(nextMetadata.phone)
    const phoneChanged = body.phone !== undefined && previousNormalizedPhone !== nextNormalizedPhone
    if (phoneChanged) {
      nextMetadata.telegramChatId = undefined
    }

    const autoLinkedChatId = await findTelegramChatIdByPhone(nextMetadata.phone)
    if (autoLinkedChatId) {
      nextMetadata.telegramChatId = autoLinkedChatId
      nextMetadata.botStatus = 'CONNECTED'
      nextMetadata.botDisconnectedAt = undefined
      nextMetadata.botLastCheckedAt = new Date().toISOString()
      nextMetadata.botLastError = undefined
    } else if (phoneChanged) {
      nextMetadata.botStatus = 'DISCONNECTED'
      nextMetadata.botDisconnectedAt = new Date().toISOString()
      nextMetadata.botLastCheckedAt = new Date().toISOString()
      nextMetadata.botLastError = 'Telefon raqami o‘zgardi, Telegram qayta ulanmagan'
    }

    const hasMetadata = Boolean(nextMetadata.username || nextMetadata.password || nextMetadata.studentId || nextMetadata.studentIds?.length)

    const parent = await prisma.parent.update({
      where: { id },
      data: {
        fullName: body.fullName || undefined,
        email: body.email || undefined,
        phone: hasMetadata
          ? encodeParentMetadata(nextMetadata)
          : (body.phone !== undefined ? (body.phone || null) : undefined)
      }
    })

    const becameConnected = !existingMeta?.telegramChatId && Boolean(nextMetadata.telegramChatId)
    if (becameConnected && nextMetadata.telegramChatId) {
      const studentName = await resolveStudentName(nextMetadata.studentId)
      const text = `🎉 <b>Xush kelibsiz!</b>\n\nHurmatli <b>${body.fullName || existing.fullName || 'ota-ona'}</b>, siz <b>${studentName}</b>ning darslarini kuzatish uchun tizimga muvaffaqiyatli qo'shildingiz.`
      await sendTelegramMessage({ chatId: nextMetadata.telegramChatId, text })
    }

    return NextResponse.json(unpackParent(parent))
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await prisma.parent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
