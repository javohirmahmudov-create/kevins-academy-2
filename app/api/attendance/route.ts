import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

export async function GET() {
  try {
    const attendance = await prisma.attendance.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(Array.isArray(attendance) ? attendance : [])
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const studentId = await resolveStudentId(body)
    const parsedDate = body.date ? new Date(body.date) : new Date()
    const data = {
      date: parsedDate.toISOString(),
      status: body.status || 'present',
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
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const studentId = await resolveStudentId(body)
    const parsedDate = body.date ? new Date(body.date) : undefined
    const data = {
      date: parsedDate ? parsedDate.toISOString() : undefined,
      status: body.status || undefined,
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
    const id = Number(url.searchParams.get('id'))
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await prisma.attendance.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
