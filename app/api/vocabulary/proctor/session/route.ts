/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildWordStates, createQuizFromStates, extractAttemptsFromScores, extractDeckFromScores } from '@/lib/vocabulary'

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const url = new URL(request.url)
    const studentId = Number(url.searchParams.get('studentId') || 0)
    const size = Math.max(3, Math.min(20, Number(url.searchParams.get('size') || 10)))

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(adminId ? { adminId } : {}),
      },
      select: { id: true, adminId: true },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const scoreRows = await prisma.score.findMany({
      where: {
        studentId,
        ...(student.adminId ? { adminId: student.adminId } : {}),
        scoreType: 'weekly',
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        breakdown: true,
        createdAt: true,
      },
    })

    const deck = extractDeckFromScores(scoreRows)
    if (deck.length === 0) {
      return NextResponse.json({
        quiz: [],
        flashcards: [],
        message: 'Vocabulary ro‘yxati topilmadi. Avval Scores bo‘limida source words kiriting.',
      })
    }

    const attempts = extractAttemptsFromScores(scoreRows)
    const states = buildWordStates({ deck, attempts })
    const quiz = createQuizFromStates(states, size)

    return NextResponse.json({
      quiz,
      flashcards: states,
      stats: {
        totalWords: states.length,
        masteredWords: states.filter((item) => item.mastered).length,
        dueWords: states.filter((item) => item.due).length,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
