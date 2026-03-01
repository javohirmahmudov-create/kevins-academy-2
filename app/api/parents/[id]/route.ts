import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { findTelegramChatIdByPhone, queueTelegramTask, sendTelegramMessage } from '@/lib/telegram'

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
      queueTelegramTask(async () => {
        await sendTelegramMessage({ chatId: nextMetadata.telegramChatId!, text })
      })
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
