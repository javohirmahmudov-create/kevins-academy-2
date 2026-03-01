import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildTelegramStartLink, findTelegramChatIdByPhone, normalizePhoneForDisplay, queueTelegramTask, sendTelegramMessage } from '@/lib/telegram'

async function resolveStudentName(studentId?: string) {
  const parsed = Number(studentId || '')
  if (!Number.isFinite(parsed) || parsed <= 0) return "o'quvchi"
  const student = await prisma.student.findUnique({ where: { id: parsed }, select: { fullName: true } })
  return student?.fullName || "o'quvchi"
}

async function maybeSendParentWelcome(input: {
  chatId?: string
  parentName?: string
  studentName?: string
}) {
  if (!input.chatId) return
  const text = `🎉 <b>Xush kelibsiz!</b>\n\nHurmatli <b>${input.parentName || 'ota-ona'}</b>, siz <b>${input.studentName || "o'quvchi"}</b>ning darslarini kuzatish uchun tizimga muvaffaqiyatli qo'shildingiz.`
  queueTelegramTask(async () => {
    await sendTelegramMessage({ chatId: input.chatId!, text })
  })
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const parents = await prisma.parent.findMany({
      where: adminId ? { adminId } : undefined,
      orderBy: { createdAt: 'desc' }
    })
    const mapped = Array.isArray(parents)
      ? parents.map((parent) => {
          const unpacked = unpackParent(parent) as any
          return {
            ...unpacked,
            telegramConnected: Boolean(unpacked?.telegramChatId),
            telegramInviteLink: buildTelegramStartLink(unpacked?.phone || parent.phone),
            normalizedPhone: normalizePhoneForDisplay(unpacked?.phone || parent.phone),
          }
        })
      : []
    return NextResponse.json(mapped)
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const metadata = {
      username: body.username || undefined,
      password: body.password || undefined,
      studentId: body.studentId || undefined,
      phone: body.phone || undefined,
      telegramChatId: undefined as string | undefined,
    }

    const autoLinkedChatId = await findTelegramChatIdByPhone(metadata.phone)
    if (autoLinkedChatId) {
      metadata.telegramChatId = autoLinkedChatId
    }

    const hasMetadata = Boolean(metadata.username || metadata.password || metadata.studentId)

    const parent = await prisma.parent.create({
      data: {
        adminId,
        fullName: body.fullName || 'Parent',
        email: body.email || null,
        phone: hasMetadata ? encodeParentMetadata(metadata) : (body.phone || null)
      }
    })

    if (autoLinkedChatId) {
      const studentName = await resolveStudentName(metadata.studentId)
      await maybeSendParentWelcome({
        chatId: autoLinkedChatId,
        parentName: body.fullName || 'ota-ona',
        studentName,
      })
    }

    return NextResponse.json(unpackParent(parent))
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const existing = await prisma.parent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
    }
    if (adminId && existing.adminId !== adminId) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const existingMeta = decodeParentMetadata(existing.phone)
    const nextMetadata = {
      username: body.username !== undefined ? (body.username || undefined) : existingMeta?.username,
      password: body.password !== undefined ? (body.password || undefined) : existingMeta?.password,
      studentId: body.studentId !== undefined ? (body.studentId || undefined) : existingMeta?.studentId,
      phone: body.phone !== undefined ? (body.phone || undefined) : (existingMeta?.phone ?? existing.phone ?? undefined),
      telegramChatId: existingMeta?.telegramChatId,
    }

    const autoLinkedChatId = await findTelegramChatIdByPhone(nextMetadata.phone)
    if (autoLinkedChatId) {
      nextMetadata.telegramChatId = autoLinkedChatId
    }

    const hasMetadata = Boolean(nextMetadata.username || nextMetadata.password || nextMetadata.studentId)

    const data = {
      fullName: body.fullName || undefined,
      email: body.email || undefined,
      phone: hasMetadata
        ? encodeParentMetadata(nextMetadata)
        : (body.phone !== undefined ? (body.phone || null) : undefined)
    }

    const parent = await prisma.parent.update({ where: { id }, data })

    const becameConnected = !existingMeta?.telegramChatId && Boolean(nextMetadata.telegramChatId)
    if (becameConnected && nextMetadata.telegramChatId) {
      const studentName = await resolveStudentName(nextMetadata.studentId)
      await maybeSendParentWelcome({
        chatId: nextMetadata.telegramChatId,
        parentName: body.fullName || existing.fullName,
        studentName,
      })
    }

    return NextResponse.json(unpackParent(parent))
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    const adminId = getAdminIdFromRequest(request)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.parent.findFirst({ where: { id, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    await prisma.parent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
