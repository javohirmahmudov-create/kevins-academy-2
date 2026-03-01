import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildParentPortalUrl, formatTelegramDate, notifyParentsByStudentId, queueTelegramTask } from '@/lib/telegram'
import { notifyParentsByStudentIdSms, queueSmsTask } from '@/lib/sms'

async function resolveStudentId(input: { studentId?: string | number; studentName?: string }) {
  if (input.studentId !== undefined && input.studentId !== null && String(input.studentId).trim() !== '') {
    const parsed = Number(input.studentId)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  if (input.studentName) {
    const student = await prisma.student.findFirst({ where: { fullName: input.studentName } })
    return student ? Number(student.id) : undefined
  }

  return undefined
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const attendance = await prisma.attendance.findMany({
      where: adminId ? { adminId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            fullName: true
          }
        }
      }
    })

    const normalized = (Array.isArray(attendance) ? attendance : []).map((item) => ({
      ...item,
      studentName: item.student?.fullName || undefined
    }))

    return NextResponse.json(normalized)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const status = body.status || 'present'
    const note = typeof body.note === 'string' ? body.note.trim() : ''

    if (status === 'late' && !note) {
      return NextResponse.json({ error: 'Kechikish sababi (comment) majburiy' }, { status: 400 })
    }

    const studentId = await resolveStudentId(body)
    const parsedDate = body.date ? new Date(body.date) : new Date()
    const data = {
      adminId,
      date: parsedDate.toISOString(),
      status,
      note: note || null,
      ...(studentId ? { studentId } : {})
    }

    const attendance = await prisma.attendance.create({ data: data as any })

    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true } })
      const studentName = student?.fullName || body.studentName || 'O\'quvchi'
      const dateText = formatTelegramDate(parsedDate)
      const statusMap: Record<string, { emoji: string; label: string; title: string; text: string }> = {
        present: {
          emoji: '✅',
          label: 'Keldi',
          title: 'Davomat yangilandi',
          text: `Hurmatli ota-ona, farzandingiz <b>${studentName}</b> <b>${dateText}</b> kuni darsda <b>hozir</b> deb belgilandi.`
        },
        late: {
          emoji: '⏰',
          label: 'Kech qoldi',
          title: 'Davomat ogohlantirishi',
          text: `Hurmatli ota-ona, farzandingiz <b>${studentName}</b> <b>${dateText}</b> kuni darsga <b>kechikib</b> keldi.${note ? `\n📝 Izoh: <i>${note}</i>` : ''}`
        },
        absent: {
          emoji: '🚨',
          label: 'Darsda yo\'q',
          title: 'Davomat ogohlantirishi',
          text: `Hurmatli ota-ona, farzandingiz <b>${studentName}</b> bugun <b>${dateText}</b> darsga qatnashmadi.`
        }
      }

      const selected = statusMap[status] || {
        emoji: '📌',
        label: String(status || 'Noma\'lum holat'),
        title: 'Davomat yangilandi',
        text: `Hurmatli ota-ona, farzandingiz <b>${studentName}</b> uchun davomat holati yangilandi: <b>${String(status || 'Noma\'lum')}</b>.`
      }

      const text = `${selected.emoji} <b>${selected.title}</b>\n\n${selected.text}\n\nHolat: <b>${selected.label}</b>.`
      const smsText = `Kevin's Academy: ${studentName} uchun davomat yangilandi. Sana: ${dateText}. Holat: ${selected.label}.${note ? ` Izoh: ${note}.` : ''}`
      const buttonUrl = buildParentPortalUrl()

      queueTelegramTask(async () => {
        await notifyParentsByStudentId({
          adminId,
          studentId,
          text,
          buttonText: "Batafsil ko'rish",
          buttonUrl,
        })
      })

      queueSmsTask(async () => {
        await notifyParentsByStudentIdSms({
          adminId,
          studentId,
          text: smsText,
        })
      })
    }

    return NextResponse.json(attendance)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const id = String(body.id || '').trim()
    const idNum = Number(id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.attendance.findFirst({ where: { id: idNum, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const studentId = await resolveStudentId(body)
    const parsedDate = body.date ? new Date(body.date) : undefined
    const status = body.status || undefined
    const note = typeof body.note === 'string' ? body.note.trim() : undefined

    if (status === 'late' && !note) {
      return NextResponse.json({ error: 'Kechikish sababi (comment) majburiy' }, { status: 400 })
    }

    const data = {
      date: parsedDate ? parsedDate.toISOString() : undefined,
      status,
      note,
      ...(studentId ? { studentId } : {})
    }

    const attendance = await prisma.attendance.update({ where: { id: idNum }, data: data as any })
    return NextResponse.json(attendance)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = String(url.searchParams.get('id') || '').trim()
    const adminId = getAdminIdFromRequest(request)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.attendance.findFirst({ where: { id: Number(id), adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    await prisma.attendance.delete({ where: { id: Number(id) } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
