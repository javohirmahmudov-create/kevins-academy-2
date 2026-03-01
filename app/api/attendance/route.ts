import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

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
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.attendance.findFirst({ where: { id: Number(id), adminId } })
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

    const attendance = await prisma.attendance.update({ where: { id }, data: data as any })
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
