import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

async function resolveStudentId(input: { studentId?: string | number; studentName?: string }) {
  if (input.studentId !== undefined && input.studentId !== null && String(input.studentId).trim() !== '') {
    const parsed = Number(input.studentId)
    return Number.isNaN(parsed) ? null : parsed
  }

  if (input.studentName) {
    const student = await prisma.student.findFirst({ where: { fullName: input.studentName } })
    return student?.id ?? null
  }

  return null
}

function extractScoreValueAndSubject(body: any) {
  const known = new Set(['id', 'studentId', 'studentName', 'value', 'subject', 'createdAt'])
  const metricEntries = Object.entries(body || {}).filter(([key, value]) => !known.has(key) && typeof value === 'number')

  if (metricEntries.length > 0) {
    const total = metricEntries.reduce((sum, [, value]) => sum + (value as number), 0)
    const avg = Math.round(total / metricEntries.length)
    return {
      value: avg,
      subject: body.subject || 'overall'
    }
  }

  const parsed = body.value !== undefined ? Number(body.value) : null
  return {
    value: Number.isFinite(parsed as number) ? parsed : 0,
    subject: body.subject || 'overall'
  }
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const scores = await prisma.score.findMany({
      where: adminId ? { adminId } : undefined,
      orderBy: { createdAt: 'desc' }
    })
    if (!Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json([])
    }

    const students = await prisma.student.findMany({ select: { id: true, fullName: true } })
    const studentMap = new Map(students.map((student) => [String(student.id), student.fullName]))
    const mapped = scores.map((score) => ({
      ...score,
      studentName: score.studentId ? (studentMap.get(String(score.studentId)) || undefined) : undefined,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const studentId = await resolveStudentId(body)
    const normalized = extractScoreValueAndSubject(body)
    const score = await prisma.score.create({
      data: {
        adminId,
        studentId,
        value: normalized.value,
        subject: normalized.subject
      }
    })
    const student = studentId ? await prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true } }) : null
    return NextResponse.json({ ...score, studentName: student?.fullName })
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

    if (adminId) {
      const owned = await prisma.score.findFirst({ where: { id, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const studentId = await resolveStudentId(body)
    const normalized = extractScoreValueAndSubject(body)
    const data = {
      studentId,
      value: normalized.value,
      subject: normalized.subject
    }

    const score = await prisma.score.update({ where: { id }, data })
    const student = score.studentId ? await prisma.student.findUnique({ where: { id: score.studentId }, select: { fullName: true } }) : null
    return NextResponse.json({ ...score, studentName: student?.fullName })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const adminId = getAdminIdFromRequest(request)
    const id = Number(url.searchParams.get('id'))
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.score.findFirst({ where: { id, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    await prisma.score.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
