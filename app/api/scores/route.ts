import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

  return {
    value: body.value !== undefined ? Number(body.value) : null,
    subject: body.subject || 'overall'
  }
}

export async function GET() {
  try {
    const scores = await prisma.score.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(Array.isArray(scores) ? scores : [])
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const studentId = await resolveStudentId(body)
    const normalized = extractScoreValueAndSubject(body)
    const score = await prisma.score.create({
      data: {
        studentId,
        value: normalized.value,
        subject: normalized.subject
      }
    })
    return NextResponse.json(score)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
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
    const normalized = extractScoreValueAndSubject(body)
    const data = {
      studentId,
      value: normalized.value,
      subject: normalized.subject
    }

    const score = await prisma.score.update({ where: { id }, data })
    return NextResponse.json(score)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await prisma.score.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
