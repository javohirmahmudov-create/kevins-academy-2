import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildParentPortalUrl, notifyParentsByStudentId } from '@/lib/telegram'

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function calculateIeltsBand(correctAnswers: number) {
  const score = clamp(Math.round(correctAnswers), 0, 40)
  if (score >= 39) return 9.0
  if (score >= 37) return 8.5
  if (score >= 35) return 8.0
  if (score >= 33) return 7.5
  if (score >= 30) return 7.0
  if (score >= 27) return 6.5
  if (score >= 23) return 6.0
  if (score >= 19) return 5.5
  if (score >= 15) return 5.0
  if (score >= 12) return 4.5
  return 4.0
}

function buildProgressBreakdown(payload: any) {
  const vocabularyTotalWords = Math.max(0, toNumber(payload.vocabularyTotalWords))
  const vocabularyKnownWords = Math.max(0, toNumber(payload.vocabularyKnownWords))
  const vocabularyUnknownWords = Math.max(0, toNumber(payload.vocabularyUnknownWords))
  const vocabularyKnownPercent = vocabularyTotalWords > 0
    ? clamp((vocabularyKnownWords / vocabularyTotalWords) * 100, 0, 100)
    : 0

  const listeningReadingCorrect = clamp(Math.round(toNumber(payload.listeningReadingCorrect)), 0, 40)
  const ieltsBand = calculateIeltsBand(listeningReadingCorrect)

  const speaking = {
    fluency: clamp(toNumber(payload.fluencyScore), 0, 9),
    lexicalResource: clamp(toNumber(payload.lexicalScore), 0, 9),
    grammar: clamp(toNumber(payload.grammarScore), 0, 9),
    pronunciation: clamp(toNumber(payload.pronunciationScore), 0, 9),
  }

  const speakingAverage = (
    speaking.fluency +
    speaking.lexicalResource +
    speaking.grammar +
    speaking.pronunciation
  ) / 4

  const attendanceEffectPercent = clamp(toNumber(payload.attendanceEffectPercent), 0, 100)
  const readingArtScore = clamp(toNumber(payload.readingArtScore), 0, 100)
  const grammarFixScore = clamp(toNumber(payload.grammarFixScore), 0, 100)

  const overallPercent = (
    (ieltsBand / 9) * 100 +
    speakingAverage * (100 / 9) +
    vocabularyKnownPercent +
    attendanceEffectPercent +
    readingArtScore +
    grammarFixScore
  ) / 6

  return {
    groupName: String(payload.groupName || '').trim() || undefined,
    listeningReading: {
      totalTests: Math.max(0, toNumber(payload.listeningTotalTests)),
      solvedTests: Math.max(0, toNumber(payload.listeningSolvedTests)),
      correctAnswers40: listeningReadingCorrect,
      scriptWritingCount: Math.max(0, toNumber(payload.scriptWritingCount)),
      podcastVideoAnalysisCount: Math.max(0, toNumber(payload.podcastVideoAnalysisCount)),
      ieltsBand,
    },
    writingSpeaking: {
      writingTask1Uploads: Math.max(0, toNumber(payload.writingTask1Uploads)),
      writingTask2Uploads: Math.max(0, toNumber(payload.writingTask2Uploads)),
      speakingGeneralCount: Math.max(0, toNumber(payload.speakingGeneralCount)),
      speakingAcademicCount: Math.max(0, toNumber(payload.speakingAcademicCount)),
      speaking,
      speakingAverage,
    },
    grammarVocabulary: {
      vocabularyTotalWords,
      vocabularyKnownWords,
      vocabularyUnknownWords,
      vocabularyKnownPercent,
      vocabularyUploadNote: String(payload.vocabularyUploadNote || '').trim() || undefined,
      vocabularyUploadFiles: Array.isArray(payload.vocabularyUploadFiles)
        ? payload.vocabularyUploadFiles.map((file: any) => String(file || '').trim()).filter(Boolean)
        : [],
      grammarTopicTests: Math.max(0, toNumber(payload.grammarTopicTests)),
      grammarFixScore,
      grammarErrorWorkCount: Math.max(0, toNumber(payload.grammarErrorWorkCount)),
    },
    articleAttendance: {
      articleReadCount: Math.max(0, toNumber(payload.articleReadCount)),
      articleTranslationCount: Math.max(0, toNumber(payload.articleTranslationCount)),
      readingArtScore,
      attendanceEffectPercent,
    },
    progressMap: {
      overallPercent,
      updatedAt: new Date().toISOString(),
    },
  }
}

async function getStudentScoped(studentId: number, adminId?: number | null) {
  if (!adminId) {
    return prisma.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true, adminId: true } })
  }

  return prisma.student.findFirst({
    where: { id: studentId, adminId },
    select: { id: true, fullName: true, adminId: true },
  })
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const url = new URL(request.url)
    const studentId = Number(url.searchParams.get('studentId') || 0)

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const student = await getStudentScoped(studentId, adminId)
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const latest = await prisma.score.findFirst({
      where: {
        studentId,
        scoreType: 'ielts_progress',
        category: 'ielts-progress-map',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!latest) return NextResponse.json({ studentId, breakdown: null })

    return NextResponse.json({
      studentId,
      scoreId: latest.id,
      overallPercent: latest.overallPercent,
      breakdown: latest.breakdown,
      updatedAt: latest.createdAt,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch IELTS progress' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const body = await request.json()
    const studentId = Number(body.studentId || 0)

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const student = await getStudentScoped(studentId, adminId)
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const breakdown = buildProgressBreakdown(body)

    const created = await prisma.score.create({
      data: {
        adminId: adminId || student.adminId || null,
        studentId,
        subject: 'IELTS Progress Map',
        category: 'ielts-progress-map',
        scoreType: 'ielts_progress',
        value: Number((breakdown.progressMap as any).overallPercent || 0),
        maxScore: 100,
        overallPercent: Number((breakdown.progressMap as any).overallPercent || 0),
        breakdown: breakdown as any,
        comment: 'IELTS Advanced Management snapshot',
      },
    })

    const vocabularyKnownPercent = Number((breakdown.grammarVocabulary as any).vocabularyKnownPercent || 0)
    if (vocabularyKnownPercent < 60) {
      const text = [
        '⚠️ <b>IELTS Vocabulary Alert</b>',
        `👤 O‘quvchi: <b>${String(student.fullName || 'Student')}</b>`,
        `📉 Bilgan so‘zlar foizi: <b>${vocabularyKnownPercent.toFixed(1)}%</b>`,
        '📚 Tavsiya: har kuni kamida 20 ta yangi so‘z + revision.',
        `🔗 Batafsil: ${buildParentPortalUrl()}`,
      ].join('\n')

      await notifyParentsByStudentId({
        adminId: adminId || student.adminId || null,
        studentId,
        text,
      })
    }

    return NextResponse.json({
      ok: true,
      scoreId: created.id,
      overallPercent: created.overallPercent,
      breakdown,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save IELTS progress' }, { status: 500 })
  }
}
