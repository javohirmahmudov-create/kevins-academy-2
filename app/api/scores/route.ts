import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

type ScoreType = 'weekly' | 'mock'

const BEGINNER_TRACK = ['vocabulary', 'grammar', 'translation', 'attendance']
const ADVANCED_TRACK = ['listening', 'reading', 'speaking', 'writing']

function normalizeLevel(rawLevel?: string | null) {
  const level = String(rawLevel || '').trim().toLowerCase()
  if (!level) return 'beginner'
  if (level.includes('advanced')) return 'advanced'
  if (level.includes('intermediate')) return 'intermediate'
  if (level.includes('elementary')) return 'elementary'
  return 'beginner'
}

function getCategoriesForLevel(level?: string | null) {
  const normalized = normalizeLevel(level)
  if (normalized === 'intermediate' || normalized === 'advanced') {
    return ADVANCED_TRACK
  }
  return BEGINNER_TRACK
}

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

function buildExamDateTime(body: any) {
  if (body.examDateTime) {
    const parsed = new Date(body.examDateTime)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (body.examDate && body.examTime) {
    const parsed = new Date(`${body.examDate}T${body.examTime}`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

function extractBreakdown(body: any, level?: string | null, maxScore?: number) {
  const chosenMax = Number(maxScore || body.maxScore || 100)
  const safeMax = chosenMax > 0 ? chosenMax : 100

  const categories = getCategoriesForLevel(level)
  const rawInput = typeof body.breakdown === 'object' && body.breakdown !== null ? body.breakdown : body
  const breakdown: Record<string, { score: number; maxScore: number; percent: number }> = {}

  for (const category of categories) {
    const rawValue = rawInput?.[category]
    const score = Number(rawValue)
    if (!Number.isFinite(score)) continue
    const bounded = Math.max(0, Math.min(score, safeMax))
    breakdown[category] = {
      score: bounded,
      maxScore: safeMax,
      percent: Number(((bounded / safeMax) * 100).toFixed(2))
    }
  }

  return breakdown
}

function calculateOverallPercent(breakdown: Record<string, { percent: number }>, fallbackValue?: number) {
  const entries = Object.values(breakdown)
  if (entries.length > 0) {
    const avg = entries.reduce((sum, item) => sum + item.percent, 0) / entries.length
    return Number(avg.toFixed(2))
  }

  const parsed = Number(fallbackValue)
  return Number.isFinite(parsed) ? parsed : 0
}

function rankStudents(items: Array<{ studentId: number; studentName: string; score: number }>) {
  const sorted = [...items].sort((a, b) => b.score - a.score)
  let lastScore: number | null = null
  let currentRank = 0

  return sorted.map((item, index) => {
    if (lastScore === null || item.score < lastScore) {
      currentRank = index + 1
      lastScore = item.score
    }
    return { ...item, rank: currentRank }
  })
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')

    if (mode === 'ranking') {
      const group = searchParams.get('group') || ''
      const scoreType = (searchParams.get('scoreType') || 'weekly') as ScoreType

      const students = await prisma.student.findMany({
        where: {
          ...(adminId ? { adminId } : {}),
          ...(group ? { group } : {})
        },
        select: { id: true, fullName: true }
      })

      if (students.length === 0) return NextResponse.json([])

      const studentIds = students.map((student) => student.id)
      const scoreRows = await prisma.score.findMany({
        where: {
          ...(adminId ? { adminId } : {}),
          scoreType,
          studentId: { in: studentIds }
        },
        orderBy: { createdAt: 'desc' }
      })

      const latestByStudent = new Map<number, { score: number }>()
      for (const row of scoreRows) {
        if (!row.studentId || latestByStudent.has(row.studentId)) continue
        latestByStudent.set(row.studentId, {
          score: Number(row.overallPercent ?? row.value ?? 0)
        })
      }

      const rankingBase = students.map((student) => ({
        studentId: student.id,
        studentName: student.fullName,
        score: latestByStudent.get(student.id)?.score ?? 0
      }))

      return NextResponse.json(rankStudents(rankingBase))
    }

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
    const scoreType = (body.scoreType === 'mock' ? 'mock' : 'weekly') as ScoreType
    const level = normalizeLevel(body.level)
    const breakdown = extractBreakdown(body, level, Number(body.maxScore || 100))
    const overallPercent =
      typeof body.overallPercent === 'number'
        ? Number(body.overallPercent)
        : calculateOverallPercent(breakdown, Number(body.value || 0))

    const examDateTime = scoreType === 'mock' ? buildExamDateTime(body) : null

    const score = await prisma.score.create({
      data: {
        adminId,
        studentId,
        value: overallPercent,
        subject: body.subject || (scoreType === 'mock' ? 'MOCK EXAM' : 'Weekly Assessment'),
        level,
        category: body.category || 'overall',
        scoreType,
        maxScore: Number(body.maxScore || 100),
        overallPercent,
        mockScore: scoreType === 'mock' ? overallPercent : null,
        examDateTime,
        breakdown
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
    const scoreType = (body.scoreType === 'mock' ? 'mock' : 'weekly') as ScoreType
    const level = normalizeLevel(body.level)
    const breakdown = extractBreakdown(body, level, Number(body.maxScore || 100))
    const overallPercent =
      typeof body.overallPercent === 'number'
        ? Number(body.overallPercent)
        : calculateOverallPercent(breakdown, Number(body.value || 0))

    const examDateTime = scoreType === 'mock' ? buildExamDateTime(body) : null

    const data = {
      studentId,
      value: overallPercent,
      subject: body.subject || (scoreType === 'mock' ? 'MOCK EXAM' : 'Weekly Assessment'),
      level,
      category: body.category || 'overall',
      scoreType,
      maxScore: Number(body.maxScore || 100),
      overallPercent,
      mockScore: scoreType === 'mock' ? overallPercent : null,
      examDateTime,
      breakdown
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
