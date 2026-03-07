/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import {
  buildWordStates,
  extractAttemptsFromScores,
  extractDeckFromScores,
  isAnswerCorrect,
} from '@/lib/vocabulary'

type SubmittedAnswer = {
  wordId?: string
  answer?: string
  elapsedMs?: number
}

export async function POST(request: Request) {
  try {
    const scopedAdminId = getAdminIdFromRequest(request)
    const body = await request.json()

    const studentId = Number(body?.studentId || 0)
    const requestedLimit = Number(body?.timeLimitSeconds || 8)
    const timeLimitSeconds = Math.max(5, Math.min(10, Number.isFinite(requestedLimit) ? requestedLimit : 8))
    const answers: SubmittedAnswer[] = Array.isArray(body?.answers) ? body.answers : []

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }
    if (answers.length === 0) {
      return NextResponse.json({ error: 'answers required' }, { status: 400 })
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(scopedAdminId ? { adminId: scopedAdminId } : {}),
      },
      select: { id: true, fullName: true, adminId: true, group: true },
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
      take: 250,
      select: {
        breakdown: true,
        createdAt: true,
      },
    })

    const deck = extractDeckFromScores(scoreRows)
    const byWordId = new Map(deck.map((item) => [item.wordId, item]))
    const graded = answers
      .map((entry) => {
        const word = byWordId.get(String(entry.wordId || '').trim())
        if (!word) return null
        const answer = String(entry.answer || '').trim()
        const elapsedMs = Math.max(0, Number(entry.elapsedMs || 0))
        const timedOut = elapsedMs > timeLimitSeconds * 1000
        const correct = !timedOut && isAnswerCorrect(answer, word.answerEn)
        return {
          wordId: word.wordId,
          promptUz: word.promptUz,
          expected: word.answerEn,
          answer,
          elapsedMs,
          timedOut,
          correct,
        }
      })
      .filter(Boolean) as Array<{
      wordId: string
      promptUz: string
      expected: string
      answer: string
      elapsedMs: number
      timedOut: boolean
      correct: boolean
    }>

    if (graded.length === 0) {
      return NextResponse.json({ error: 'No valid words found in submission' }, { status: 400 })
    }

    const correctCount = graded.filter((item) => item.correct).length
    const total = graded.length
    const percent = Math.round((correctCount / total) * 100)

    const attempts = extractAttemptsFromScores(scoreRows)
    const currentAttemptTime = new Date().toISOString()
    const currentAttempts = graded.map((item) => ({
      wordId: item.wordId,
      expected: item.expected,
      correct: item.correct,
      createdAt: currentAttemptTime,
    }))

    const updatedStates = buildWordStates({
      deck,
      attempts: [...attempts, ...currentAttempts],
    })

    const created = await prisma.score.create({
      data: {
        adminId: student.adminId || undefined,
        studentId: student.id,
        subject: 'Vocabulary AI Proctor',
        category: 'vocabulary_proctor',
        scoreType: 'weekly',
        maxScore: 100,
        value: percent,
        overallPercent: percent,
        comment: `AI proctor: ${correctCount}/${total} (${percent}%)`,
        breakdown: {
          vocabulary: {
            score: percent,
            maxScore: 100,
            percent,
            wordList: graded.filter((item) => item.correct).map((item) => item.expected),
            sourceWordList: deck.map((item) => `${item.promptUz} -> ${item.answerEn}`),
          },
          vocabularyProctor: {
            total,
            correctCount,
            percent,
            timeLimitSeconds,
            answers: graded,
            submittedAt: currentAttemptTime,
          },
          spacedRepetition: {
            totalWords: updatedStates.length,
            masteredWords: updatedStates.filter((item) => item.mastered).length,
            dueWords: updatedStates.filter((item) => item.due).length,
          },
        },
      },
      select: { id: true, createdAt: true },
    })

    return NextResponse.json({
      ok: true,
      scoreId: created.id,
      createdAt: created.createdAt,
      result: {
        total,
        correctCount,
        percent,
        timeLimitSeconds,
        details: graded,
      },
      spacedRepetition: {
        totalWords: updatedStates.length,
        masteredWords: updatedStates.filter((item) => item.mastered).length,
        dueWords: updatedStates.filter((item) => item.due).length,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
