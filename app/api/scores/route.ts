import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildParentPortalUrl, formatTelegramDate, notifyParentsByStudentId, queueTelegramTask } from '@/lib/telegram'
import { notifyParentsByStudentIdSms, queueSmsTask } from '@/lib/sms'

type ScoreType = 'weekly' | 'mock'

const BEGINNER_TRACK = ['vocabulary', 'grammar', 'translation', 'attendance']
const ADVANCED_TRACK = ['listening', 'reading', 'speaking', 'writing']

const CATEGORY_LABEL_UZ: Record<string, string> = {
  vocabulary: 'Lug‘at',
  grammar: 'Grammatika',
  translation: 'Tarjima',
  attendance: 'Davomat',
  listening: 'Listening',
  reading: 'Reading',
  speaking: 'Speaking',
  writing: 'Writing',
}

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

async function getGroupRankingData(input: {
  adminId?: number | null
  studentId?: number | null
  group?: string | null
  scoreType: ScoreType
}) {
  if (!input.studentId || !input.group) return { rank: 0, leaderboard: [] as Array<{ rank: number; studentName: string; score: number }> }

  const students = await prisma.student.findMany({
    where: {
      ...(input.adminId ? { adminId: input.adminId } : {}),
      group: input.group,
    },
    select: { id: true, fullName: true }
  })

  if (!students.length) return { rank: 0, leaderboard: [] as Array<{ rank: number; studentName: string; score: number }> }

  const studentIds = students.map((student) => student.id)
  const scoreRows = await prisma.score.findMany({
    where: {
      ...(input.adminId ? { adminId: input.adminId } : {}),
      scoreType: input.scoreType,
      studentId: { in: studentIds }
    },
    orderBy: { createdAt: 'desc' }
  })

  const latestByStudent = new Map<number, number>()
  for (const row of scoreRows) {
    if (!row.studentId || latestByStudent.has(row.studentId)) continue
    latestByStudent.set(row.studentId, Number(row.overallPercent ?? row.value ?? 0))
  }

  const ranked = rankStudents(
    students.map((student) => ({
      studentId: student.id,
      studentName: student.fullName,
      score: latestByStudent.get(student.id) ?? 0,
    }))
  )

  return {
    rank: ranked.find((item) => item.studentId === input.studentId)?.rank || 0,
    leaderboard: ranked.map((item) => ({
      rank: item.rank,
      studentName: item.studentName,
      score: Number(item.score || 0),
    })),
  }
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
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''

    const score = await prisma.score.create({
      data: {
        adminId,
        studentId,
        value: overallPercent,
        subject: body.subject || (scoreType === 'mock' ? 'MOCK imtihon' : 'Baholash'),
        comment: comment || null,
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

    if (studentId) {
      const studentWithGroup = await prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true, group: true } })
      const rankingData = await getGroupRankingData({
        adminId,
        studentId,
        group: studentWithGroup?.group,
        scoreType,
      })

      const subject = body.subject || (scoreType === 'mock' ? 'MOCK imtihon' : 'Baholash')
      const scoreValue = Number(overallPercent || 0)
      const scoreDate = formatTelegramDate(scoreType === 'mock' ? examDateTime : score.createdAt)
      const breakdownRows = (breakdown && typeof breakdown === 'object')
        ? Object.entries(breakdown as Record<string, any>)
            .map(([key, value]) => {
              const scorePart = Number((value as any)?.score ?? 0)
              const maxPart = Number((value as any)?.maxScore ?? maxScore)
              const percentPart = Number((value as any)?.percent ?? 0)
              const label = CATEGORY_LABEL_UZ[key] || key
              return `• <b>${label}</b>: ${scorePart}/${maxPart} (${percentPart}%)`
            })
        : []

      const leaderboardText = rankingData.leaderboard.length
        ? rankingData.leaderboard
            .map((item) => `${item.rank}. ${item.studentName} — ${Number(item.score).toFixed(1)}%`)
            .join('\n')
        : 'Reyting ma’lumoti mavjud emas.'

      const text = [
        '📊 <b>Yangi ball qo‘shildi</b>',
        '',
        `👤 O‘quvchi: <b>${studentWithGroup?.fullName || student?.fullName || "O‘quvchi"}</b>`,
        `📅 Sana: <b>${scoreDate}</b>`,
        `🧭 Daraja: <b>${level}</b>`,
        `📝 Baholash turi: <b>${subject}</b>`,
        ...(breakdownRows.length ? ['', '<b>Bo‘limlar kesimi:</b>', ...breakdownRows] : []),
        '',
        `📈 Umumiy ball: <b>${scoreValue}%</b>`,
        `🏅 Guruhdagi o‘rni: <b>${rankingData.rank || 0}-o‘rin</b>`,
        '',
        '<b>📋 Guruh reytingi:</b>',
        leaderboardText,
      ].join('\n')

      const smsText = `Kevin's Academy: ${scoreDate} kuni ${subject} natijasi. Umumiy ball: ${scoreValue}%. Guruhdagi o‘rni: ${rankingData.rank || 0}-o‘rin.`
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
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''

    const data = {
      studentId,
      value: overallPercent,
      subject: body.subject || (scoreType === 'mock' ? 'MOCK EXAM' : 'Weekly Assessment'),
      comment: comment || null,
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
