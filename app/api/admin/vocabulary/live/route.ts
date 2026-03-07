/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildWordStates, extractAttemptsFromScores, extractDeckFromScores } from '@/lib/vocabulary'

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope required' }, { status: 401 })
    }

    const url = new URL(request.url)
    const group = String(url.searchParams.get('group') || '').trim()

    const students = await prisma.student.findMany({
      where: {
        adminId,
        ...(group ? { group } : {}),
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        group: true,
      },
    })

    if (!students.length) {
      return NextResponse.json({ livePercent: 0, rows: [] })
    }

    const studentIds = students.map((item) => item.id)
    const scoreRows = await prisma.score.findMany({
      where: {
        adminId,
        studentId: { in: studentIds },
        scoreType: 'weekly',
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(300, studentIds.length * 25),
      select: {
        studentId: true,
        breakdown: true,
        createdAt: true,
      },
    })

    const rows = students.map((student) => {
      const studentScores = scoreRows.filter((item) => item.studentId === student.id)
      const deck = extractDeckFromScores(studentScores)
      const attempts = extractAttemptsFromScores(studentScores)
      const states = buildWordStates({ deck, attempts })

      const totalWords = states.length
      const masteredWords = states.filter((item) => item.mastered).length
      const dueWords = states.filter((item) => item.due).length
      const progressPercent = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0
      const nextReviewAt = states
        .map((item) => item.nextReviewAt)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || null

      return {
        studentId: student.id,
        studentName: student.fullName,
        group: student.group || '',
        totalWords,
        masteredWords,
        dueWords,
        progressPercent,
        nextReviewAt,
        lastAttemptAt: studentScores[0]?.createdAt || null,
      }
    })

    const livePercent = rows.length > 0
      ? Math.round(rows.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / rows.length)
      : 0

    return NextResponse.json({ livePercent, rows })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
