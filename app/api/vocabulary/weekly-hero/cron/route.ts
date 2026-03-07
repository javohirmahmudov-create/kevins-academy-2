/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendTelegramMessage } from '@/lib/telegram'

type HeroCandidate = {
  studentId: number
  adminId?: number | null
  studentName: string
  duelWins: number
  proctorBest: number
  totalScore: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const TZ = process.env.BUSINESS_TIMEZONE || 'Asia/Tashkent'

function canRun(request: Request) {
  const secret = process.env.WEEKLY_HERO_CRON_SECRET || process.env.CRON_SECRET || ''
  if (!secret) return true
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${secret}`
}

function getLocalNow(now = new Date(), timezone = TZ) {
  return new Date(now.toLocaleString('en-US', { timeZone: timezone }))
}

function getWeekWindow(now = new Date(), timezone = TZ) {
  const localNow = getLocalNow(now, timezone)
  const day = localNow.getDay()
  const diffToMonday = (day + 6) % 7

  const localStart = new Date(localNow)
  localStart.setHours(0, 0, 0, 0)
  localStart.setDate(localStart.getDate() - diffToMonday)

  const tzShift = now.getTime() - localNow.getTime()
  const weekStart = new Date(localStart.getTime() + tzShift)
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)

  const weekKey = `${localStart.getFullYear()}-${String(localStart.getMonth() + 1).padStart(2, '0')}-${String(localStart.getDate()).padStart(2, '0')}`
  return { weekStart, weekEnd, weekKey, localNow }
}

function isSunday21(localNow: Date) {
  return localNow.getDay() === 0 && localNow.getHours() >= 21
}

function parseDuelIdFromBreakdown(breakdown: any) {
  const peer = breakdown?.peerChecking && typeof breakdown.peerChecking === 'object' ? breakdown.peerChecking : null
  const duelId = Number(peer?.duelId || 0)
  return Number.isFinite(duelId) && duelId > 0 ? duelId : 0
}

function parsePeerStudentIdFromBreakdown(breakdown: any) {
  const peer = breakdown?.peerChecking && typeof breakdown.peerChecking === 'object' ? breakdown.peerChecking : null
  const studentId = Number(peer?.studentId || 0)
  return Number.isFinite(studentId) && studentId > 0 ? studentId : 0
}

function formatLeaderboard(top: HeroCandidate[]) {
  return top
    .map((row, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
      return `${medal} ${row.studentName} — Duel: ${row.duelWins}, Proctor: ${row.proctorBest.toFixed(1)}%`
    })
    .join('\n')
}

export async function GET(request: Request) {
  try {
    if (!canRun(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const force = String(url.searchParams.get('force') || '').trim() === '1'

    const now = new Date()
    const { weekStart, weekEnd, weekKey, localNow } = getWeekWindow(now)

    if (!force && !isSunday21(localNow)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'outside_schedule_window',
        expected: 'Yakshanba 21:00 (business timezone)',
        localNow: localNow.toISOString(),
      })
    }

    const existing = await prisma.weeklyHero.findMany({
      where: { weekKey },
      orderBy: { rank: 'asc' },
      select: { id: true },
    })

    if (existing.length >= 3 && !force) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'already_computed',
        weekKey,
      })
    }

    const [peerRows, proctorRows, studentRows, groupRows] = await Promise.all([
      prisma.score.findMany({
        where: {
          category: 'peer_check',
          createdAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        select: {
          studentId: true,
          value: true,
          breakdown: true,
          createdAt: true,
        },
        take: 5000,
      }),
      prisma.score.findMany({
        where: {
          category: 'vocabulary_proctor',
          createdAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        select: {
          studentId: true,
          value: true,
          createdAt: true,
        },
        take: 5000,
      }),
      prisma.student.findMany({
        select: {
          id: true,
          fullName: true,
          adminId: true,
        },
      }),
      prisma.group.findMany({
        where: {
          telegramChatId: {
            not: null,
          },
        },
        select: {
          name: true,
          telegramChatId: true,
        },
      }),
    ])

    const studentMap = new Map(studentRows.map((student) => [Number(student.id), student]))

    const duelScoreMap = new Map<number, Array<{ studentId: number; value: number; createdAt: Date }>>()
    for (const row of peerRows) {
      const duelId = parseDuelIdFromBreakdown(row.breakdown)
      const fallbackStudentId = Number(row.studentId || 0)
      const parsedStudentId = parsePeerStudentIdFromBreakdown(row.breakdown)
      const studentId = parsedStudentId || fallbackStudentId
      if (!duelId || !studentId) continue
      const scoreValue = Number(row.value || 0)
      if (!Number.isFinite(scoreValue)) continue
      const arr = duelScoreMap.get(duelId) || []
      arr.push({ studentId, value: scoreValue, createdAt: new Date(row.createdAt) })
      duelScoreMap.set(duelId, arr)
    }

    const duelWinsMap = new Map<number, number>()
    for (const [, entries] of duelScoreMap) {
      const byStudent = new Map<number, { value: number; createdAt: Date }>()
      for (const entry of entries) {
        const current = byStudent.get(entry.studentId)
        if (!current || entry.createdAt.getTime() > current.createdAt.getTime()) {
          byStudent.set(entry.studentId, { value: entry.value, createdAt: entry.createdAt })
        }
      }
      const unique = Array.from(byStudent.entries())
      if (unique.length < 2) continue
      unique.sort((a, b) => b[1].value - a[1].value)
      const top = unique[0]
      const second = unique[1]
      if (!top || !second) continue
      if (top[1].value === second[1].value) continue
      duelWinsMap.set(top[0], Number(duelWinsMap.get(top[0]) || 0) + 1)
    }

    const proctorBestMap = new Map<number, number>()
    for (const row of proctorRows) {
      const studentId = Number(row.studentId || 0)
      const value = Number(row.value || 0)
      if (!studentId || !Number.isFinite(value)) continue
      const best = Number(proctorBestMap.get(studentId) || 0)
      if (value > best) {
        proctorBestMap.set(studentId, value)
      }
    }

    const candidateIds = new Set<number>([
      ...Array.from(duelWinsMap.keys()),
      ...Array.from(proctorBestMap.keys()),
    ])

    const candidates: HeroCandidate[] = Array.from(candidateIds)
      .map((studentId) => {
        const student = studentMap.get(studentId)
        if (!student) return null
        const duelWins = Number(duelWinsMap.get(studentId) || 0)
        const proctorBest = Number(proctorBestMap.get(studentId) || 0)
        const totalScore = duelWins * 1000 + proctorBest
        return {
          studentId,
          adminId: student.adminId || null,
          studentName: String(student.fullName || `Student #${studentId}`),
          duelWins,
          proctorBest,
          totalScore,
        }
      })
      .filter(Boolean) as HeroCandidate[]

    candidates.sort((left, right) => {
      if (right.duelWins !== left.duelWins) return right.duelWins - left.duelWins
      if (right.proctorBest !== left.proctorBest) return right.proctorBest - left.proctorBest
      return left.studentName.localeCompare(right.studentName)
    })

    const topThree = candidates.slice(0, 3)
    if (!topThree.length) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'no_candidates',
        weekKey,
      })
    }

    const badgeStartAt = now
    const badgeEndAt = new Date(now.getTime() + 7 * DAY_MS)

    await prisma.$transaction([
      prisma.weeklyHero.deleteMany({ where: { weekKey } }),
      ...topThree.map((item, index) => prisma.weeklyHero.create({
        data: {
          weekKey,
          rank: index + 1,
          studentId: item.studentId,
          adminId: item.adminId || undefined,
          studentName: item.studentName,
          duelWins: item.duelWins,
          proctorBest: item.proctorBest,
          totalScore: item.totalScore,
          badgeStartAt,
          badgeEndAt,
        },
      })),
    ])

    const appBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || new URL(request.url).origin
    const winner = topThree[0]
    const winnerCardUrl = `${String(appBase).replace(/\/$/, '')}/api/vocabulary/weekly-hero/card?weekKey=${encodeURIComponent(weekKey)}&rank=1`
    const text = [
      `🎉 Tabriklaymiz! Bu haftaning eng bilimdon o'quvchisi — ${winner.studentName}! 🥇`,
      '',
      '🏆 Hafta Qahramonlari TOP-3:',
      formatLeaderboard(topThree),
      '',
      `🖼 Luxury Gold card: ${winnerCardUrl}`,
    ].join('\n')

    let announced = 0
    for (const group of groupRows) {
      const chatId = String(group.telegramChatId || '').trim()
      if (!chatId) continue
      const sent = await sendTelegramMessage({
        chatId,
        text,
        buttonUrl: winnerCardUrl,
        buttonText: '🏆 G‘olib kartasini ochish',
      })
      if (sent.ok) announced += 1
    }

    return NextResponse.json({
      ok: true,
      weekKey,
      window: {
        weekStart,
        weekEnd,
      },
      topThree,
      announced,
      badgeEndAt,
      winnerCardUrl,
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
