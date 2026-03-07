import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { sendScoreNotification } from '@/lib/notifications'

type ScoreType = 'weekly' | 'mock'

class InputValidationError extends Error {
  status = 400
}

const FOUNDATION_TRACK = ['grammar', 'vocabulary', 'speed_reading', 'translation', 'attendance']
const ACADEMIC_TRACK = ['listening', 'reading', 'writing', 'speaking', 'grammar', 'vocabulary', 'translation']

const CATEGORY_LABEL_UZ: Record<string, string> = {
  vocabulary: 'Lug‘at',
  grammar: 'Grammatika',
  speed_reading: 'Tez o‘qish',
  translation: 'Tarjima',
  attendance: 'Davomat',
  listening: 'Listening',
  reading: 'Reading',
  speaking: 'Speaking',
  writing: 'Writing',
}

const WRITING_EXPERT_TO_STANDARD: Record<string, number> = {
  '0': 0,
  '0.5': 6,
  '1': 11,
  '1.5': 13,
  '2': 15,
  '2.5': 18,
  '3': 21,
  '3.5': 23,
  '4': 26,
  '4.5': 29,
  '5': 32,
  '5.5': 35,
  '6': 38,
  '6.5': 40,
  '7': 42,
  '7.5': 43,
  '8': 45,
  '8.5': 47,
  '9': 49,
  '9.5': 50,
  '10': 51,
  '10.5': 53,
  '11': 54,
  '11.5': 56,
  '12': 57,
  '12.5': 59,
  '13': 61,
  '13.5': 62,
  '14': 63,
  '14.5': 65,
  '15': 67,
  '15.5': 69,
  '16': 72,
  '16.5': 74,
  '17': 75,
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
    return ACADEMIC_TRACK
  }
  return FOUNDATION_TRACK
}

async function resolveStudentId(input: { studentId?: string | number; studentName?: string; adminId?: number | null }) {
  if (input.studentId !== undefined && input.studentId !== null && String(input.studentId).trim() !== '') {
    const parsed = Number(input.studentId)
    return Number.isNaN(parsed) ? null : parsed
  }

  if (input.studentName) {
    const student = await prisma.student.findFirst({
      where: {
        fullName: input.studentName,
        ...(input.adminId ? { adminId: Number(input.adminId) } : {}),
      }
    })
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

async function askGeminiShort(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
  if (!apiKey) return ''

  const models = (process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-1.5-flash-latest')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  for (const model of models.length ? models : ['gemini-2.0-flash']) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 180,
          },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) continue
      const data = await response.json()
      const text = (data?.candidates || [])
        .flatMap((candidate: any) => candidate?.content?.parts || [])
        .map((part: any) => part?.text)
        .filter(Boolean)
        .join('\n')
        .trim()
      if (text) return text
    } catch {
      continue
    }
  }

  return ''
}

async function buildGrammarParentSummary(input: {
  studentName: string
  grammarTopic: string
  sentenceStructure: number
  topicMastery: number
  spelling: number
}) {
  const topic = String(input.grammarTopic || '').trim() || 'Grammar'
  const fallback = [
    `Bugun farzandingiz ${topic} mavzusini o‘rgandi.`,
    `Gap tuzish qobiliyati ${input.sentenceStructure}/40, mavzuni o‘zlashtirish ${input.topicMastery}/40, imlo ${input.spelling}/20.`,
    `Kevin AI tavsiyasi: o‘quvchi mavzuni tushungan, lekin yozuvda diqqatni oshirishi kerak.`
  ].join(' ')

  const prompt = [
    'Siz Kevin Academy uchun professional ota-ona xulosa yozuvchi AI yordamchisiz.',
    'Faqat o\'zbek tilida 2-3 gaplik juda aniq xulosa yozing.',
    'Format: Bugun farzandingiz {Topic} mavzusini o‘rgandi... Kevin AI tavsiyasi: ...',
    `O‘quvchi: ${input.studentName}`,
    `Topic: ${topic}`,
    `Sentence Structure: ${input.sentenceStructure}/40`,
    `Topic Mastery: ${input.topicMastery}/40`,
    `Spelling: ${input.spelling}/20`,
  ].join('\n')

  const aiText = await askGeminiShort(prompt)
  return aiText || fallback
}

async function buildIntermediateWritingInsights(input: {
  taskResponse: number
  cohesion: number
  grammar: number
}) {
  const fallbackGrammarAccuracy = Math.max(0, Math.min(100, Math.round((input.grammar * 0.7) + (input.cohesion * 0.3))))
  const fallbackLexicalResource = Math.max(0, Math.min(100, Math.round((input.taskResponse * 0.6) + (input.cohesion * 0.4))))
  const fallbackMistakes = [
    'Articles',
    'Punctuation',
    'Sentence structure',
  ]

  const prompt = [
    'Siz IELTS Writing tahlilchi AIsiz.',
    'Berilgan mezonlar asosida faqat JSON qaytaring.',
    'JSON format:',
    '{"grammarAccuracy":0-100,"lexicalResource":0-100,"mistakes":["xato1","xato2","xato3"]}',
    `Task Response: ${input.taskResponse}`,
    `Cohesion: ${input.cohesion}`,
    `Grammar: ${input.grammar}`,
  ].join('\n')

  const aiText = await askGeminiShort(prompt)
  if (!aiText) {
    return {
      grammarAccuracy: fallbackGrammarAccuracy,
      lexicalResource: fallbackLexicalResource,
      mistakes: fallbackMistakes,
    }
  }

  const jsonCandidate = (() => {
    const raw = String(aiText).trim()
    const first = raw.indexOf('{')
    const last = raw.lastIndexOf('}')
    if (first === -1 || last === -1 || last <= first) return ''
    return raw.slice(first, last + 1)
  })()

  try {
    const parsed = jsonCandidate ? JSON.parse(jsonCandidate) : JSON.parse(aiText)
    const grammarAccuracy = Math.max(0, Math.min(100, Number(parsed?.grammarAccuracy || fallbackGrammarAccuracy)))
    const lexicalResource = Math.max(0, Math.min(100, Number(parsed?.lexicalResource || fallbackLexicalResource)))
    const mistakes = Array.isArray(parsed?.mistakes)
      ? parsed.mistakes.map((item: any) => String(item || '').trim()).filter(Boolean).slice(0, 3)
      : fallbackMistakes

    return {
      grammarAccuracy,
      lexicalResource,
      mistakes: mistakes.length ? mistakes : fallbackMistakes,
    }
  } catch {
    return {
      grammarAccuracy: fallbackGrammarAccuracy,
      lexicalResource: fallbackLexicalResource,
      mistakes: fallbackMistakes,
    }
  }
}

async function buildIntermediateParentSummary(input: {
  studentName: string
  listening: number
  reading: number
  writing: number
  speaking: number
  timeSpentMinutes?: number
}) {
  const scores = [
    { key: 'Listening', value: Number(input.listening || 0) },
    { key: 'Reading', value: Number(input.reading || 0) },
    { key: 'Writing', value: Number(input.writing || 0) },
    { key: 'Speaking', value: Number(input.speaking || 0) },
  ]

  const average = scores.reduce((sum, item) => sum + item.value, 0) / scores.length
  const cefr = average >= 75 ? 'B2' : average >= 60 ? 'B1+' : 'B1'
  const strongest = [...scores].sort((a, b) => b.value - a.value)[0]?.key || 'Reading'
  const weakest = [...scores].sort((a, b) => a.value - b.value)[0]?.key || 'Writing'
  const fallback = `Farzandingiz bugungi Mock Exam natijalariga ko‘ra ${cefr} darajasida. Uning eng kuchli tomoni — ${strongest}, lekin ${weakest} ustida ishlash kerak.`

  const prompt = [
    'Siz Kevin Academy uchun ota-onaga xulosa yozuvchi AI yordamchisiz.',
    'Faqat o‘zbek tilida 2-3 gap yozing.',
    'CEFR faqat B1, B1+, B2 bo‘lsin.',
    `Student: ${input.studentName}`,
    `Listening: ${input.listening}/100`,
    `Reading: ${input.reading}/100`,
    `Writing: ${input.writing}/100`,
    `Speaking: ${input.speaking}/100`,
    `Time Spent (minutes): ${Number(input.timeSpentMinutes || 0)}`,
    'Format: "Farzandingiz ... darajasida. Eng kuchli tomoni ... lekin ... ustida ishlash kerak."',
  ].join('\n')

  const aiText = await askGeminiShort(prompt)
  return aiText || fallback
}

function extractBreakdown(body: any, level?: string | null, maxScore?: number) {
  const chosenMax = Number(maxScore || body.maxScore || 100)
  const safeMax = chosenMax > 0 ? chosenMax : 100

  const categories = getCategoriesForLevel(level)
  const rawInput =
    typeof body.breakdown === 'object' && body.breakdown !== null
      ? body.breakdown
      : (typeof body.sections === 'object' && body.sections !== null ? body.sections : body)
  const breakdown: Record<string, any> = {}

  for (const category of categories) {
    const rawValue = rawInput?.[category]
    const hasObjectValue = rawValue && typeof rawValue === 'object'

    if (category === 'vocabulary' && hasObjectValue) {
      const totalWords = Number((rawValue as any).totalWords)
      const memorizedWords = Number((rawValue as any).memorizedWords)

      if (Number.isFinite(totalWords) && Number.isFinite(memorizedWords)) {
        if (totalWords <= 0) {
          throw new InputValidationError("Vocabulary uchun Total Words 0 dan katta bo'lishi kerak")
        }
        if (memorizedWords > totalWords) {
          throw new InputValidationError("Xatolik: Yodlangan so'zlar jami so'zlardan ko'p bo'lishi mumkin emas")
        }

        const normalizedMemorized = Math.max(0, Math.min(memorizedWords, totalWords))
        const vocabularyPercent = Number(((normalizedMemorized / totalWords) * 100).toFixed(2))
        const scaledScore = Number(((vocabularyPercent / 100) * safeMax).toFixed(2))
        const providedComment = typeof (rawValue as any).comment === 'string' ? String((rawValue as any).comment).trim() : ''
        const autoComment = `Bugungi ${totalWords} ta yangi so'zdan ${normalizedMemorized} tasini xatosiz yozdi.`
        const wordListRaw = Array.isArray((rawValue as any).wordList) ? (rawValue as any).wordList : []
        const wordList = wordListRaw
          .map((item: any) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 50)
        const sourceWordListRaw = Array.isArray((rawValue as any).sourceWordList) ? (rawValue as any).sourceWordList : []
        const sourceWordList = sourceWordListRaw
          .map((item: any) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 200)

        breakdown[category] = {
          score: scaledScore,
          maxScore: safeMax,
          percent: vocabularyPercent,
          comment: providedComment || autoComment,
          totalWords,
          memorizedWords: normalizedMemorized,
          pronunciationBonus: Boolean((rawValue as any).pronunciationBonus),
          wordList,
          sourceWordList,
        }
        continue
      }
    }

    if (category === 'grammar' && hasObjectValue) {
      const sentenceStructure = Number((rawValue as any).sentenceStructure)
      const topicMastery = Number((rawValue as any).topicMastery ?? (rawValue as any).toBeTenses)
      const spelling = Number((rawValue as any).spelling)
      const grammarTopic = typeof (rawValue as any).grammarTopic === 'string' ? String((rawValue as any).grammarTopic).trim() : ''

      if (Number.isFinite(sentenceStructure) && Number.isFinite(topicMastery) && Number.isFinite(spelling)) {
        const safeSentence = Math.max(0, Math.min(40, sentenceStructure))
        const safeTopicMastery = Math.max(0, Math.min(40, topicMastery))
        const safeSpelling = Math.max(0, Math.min(20, spelling))
        const rawTotal = safeSentence + safeTopicMastery + safeSpelling
        const grammarPercent = Number(rawTotal.toFixed(2))
        const scaledScore = Number(((grammarPercent / 100) * safeMax).toFixed(2))
        const providedComment = typeof (rawValue as any).comment === 'string' ? String((rawValue as any).comment).trim() : ''

        breakdown[category] = {
          score: scaledScore,
          maxScore: safeMax,
          percent: grammarPercent,
          ...(providedComment ? { comment: providedComment } : {}),
          sentenceStructure: safeSentence,
          topicMastery: safeTopicMastery,
          toBeTenses: safeTopicMastery,
          spelling: safeSpelling,
          ...(grammarTopic ? { grammarTopic } : {}),
          rawScore: rawTotal,
        }
        continue
      }
    }

    if (category === 'translation' && hasObjectValue) {
      const readingFlow = Number((rawValue as any).readingFlow)
      const accuracy = Number((rawValue as any).accuracy)
      const pronunciation = Number((rawValue as any).pronunciation)

      if (Number.isFinite(readingFlow) && Number.isFinite(accuracy) && Number.isFinite(pronunciation)) {
        const safeReadingFlow = Math.max(0, Math.min(10, readingFlow))
        const safeAccuracy = Math.max(0, Math.min(10, accuracy))
        const safePronunciation = Math.max(0, Math.min(10, pronunciation))
        const rawTotal = safeReadingFlow + safeAccuracy + safePronunciation
        const translationPercent = Number(((rawTotal / 30) * 100).toFixed(2))
        const scaledScore = Number(((translationPercent / 100) * safeMax).toFixed(2))
        const providedComment = typeof (rawValue as any).comment === 'string' ? String((rawValue as any).comment).trim() : ''
        const readingFlowComment = safeReadingFlow <= 3
          ? 'Matnni ravon o‘qishda qiynaldi.'
          : safeReadingFlow <= 7
            ? 'Matnni o‘qish ravonligi o‘rtacha, yana mashq kerak.'
            : 'Matnni ravon o‘qishi yaxshi.'
        const accuracyComment = safeAccuracy <= 3
          ? 'Tarjimada ma’no xatolari ko‘p bo‘ldi.'
          : safeAccuracy <= 7
            ? 'Tarjima aniqligi o‘rtacha, diqqat bilan ishlash kerak.'
            : 'Tarjima aniqligi yaxshi.'
        const pronunciationComment = safePronunciation <= 3
          ? 'Talaffuz ustida ko‘proq ishlash kerak.'
          : safePronunciation <= 7
            ? 'Talaffuz o‘rtacha, mashq bilan tez yaxshilanadi.'
            : 'Talaffuz yaxshi.'
        const autoComment = [
          translationPercent < 65
            ? "Farzandingiz matnni o‘qishda va tarjima qilishda biroz qiynaldi, uyda darslikdagi matnlarni baland ovozda o‘qish tavsiya etiladi."
            : 'Tarjima va o‘qish bo‘yicha yaxshi o‘sish bor, muntazam mashq davom ettirilsin.',
          readingFlowComment,
          accuracyComment,
          pronunciationComment,
        ].join(' ')

        breakdown[category] = {
          score: scaledScore,
          maxScore: safeMax,
          percent: translationPercent,
          comment: providedComment || autoComment,
          readingFlow: safeReadingFlow,
          accuracy: safeAccuracy,
          pronunciation: safePronunciation,
          rawScore: rawTotal,
        }
        continue
      }
    }

    if ((category === 'listening' || category === 'reading') && hasObjectValue) {
      const partLimits = category === 'listening'
        ? { part1: 8, part2: 6, part3: 4, part4: 5, part5: 6, part6: 6 }
        : { part1: 6, part2: 8, part3: 6, part4: 9, part5: 6 }
      const partSource = ((category === 'listening' ? (rawValue as any).listeningParts : (rawValue as any).readingParts) || {}) as Record<string, any>
      const normalizedParts = Object.entries(partLimits).reduce((acc, [key, max]) => {
        const value = Number(partSource?.[key])
        acc[key] = Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0
        return acc
      }, {} as Record<string, number>)
      const partCorrect = Object.values(normalizedParts).reduce((sum, value) => sum + Number(value || 0), 0)
      const partTotal = Object.values(partLimits).reduce((sum, value) => sum + Number(value || 0), 0)

      const totalQuestions = Number((rawValue as any).totalQuestions)
      const correctAnswers = Number((rawValue as any).correctAnswers)
      const timeSpentMinutes = Number((rawValue as any).timeSpentMinutes)
      const providedComment = typeof (rawValue as any).comment === 'string' ? String((rawValue as any).comment).trim() : ''
      const weakestPart = typeof (rawValue as any).weakestPart === 'string' ? String((rawValue as any).weakestPart).trim() : ''
      const selected = Boolean((rawValue as any).selected)

      const hasExplicitTotals = Number.isFinite(totalQuestions) && totalQuestions > 0 && Number.isFinite(correctAnswers)
      const safeTotal = hasExplicitTotals ? Math.max(1, Math.round(totalQuestions)) : partTotal
      const safeCorrect = hasExplicitTotals
        ? Math.max(0, Math.min(safeTotal, Math.round(correctAnswers)))
        : Math.max(0, Math.min(partTotal, partCorrect))

      if (safeTotal > 0) {
        const sectionPercent = Number(((safeCorrect / safeTotal) * 100).toFixed(2))
        const scaledScore = Number(((sectionPercent / 100) * safeMax).toFixed(2))

        breakdown[category] = {
          score: scaledScore,
          maxScore: safeMax,
          percent: sectionPercent,
          comment: providedComment || `Correct: ${safeCorrect}/${safeTotal}${weakestPart ? `, Weakest: ${weakestPart}` : ''}`,
          totalQuestions: safeTotal,
          correctAnswers: safeCorrect,
          ...(selected ? { selected } : {}),
          ...(weakestPart ? { weakestPart } : {}),
          ...(category === 'listening' ? { listeningParts: normalizedParts } : { readingParts: normalizedParts }),
          ...(Number.isFinite(timeSpentMinutes) ? { timeSpentMinutes: Math.max(0, Math.round(timeSpentMinutes)) } : {})
        }
        continue
      }
    }

    if (category === 'writing' && hasObjectValue) {
      const task11 = Number((rawValue as any).task11)
      const task12 = Number((rawValue as any).task12)
      const task2 = Number((rawValue as any).task2)
      const taskResponse = Number.isFinite(task11) ? task11 : Number((rawValue as any).taskResponse)
      const cohesion = Number.isFinite(task12) ? task12 : Number((rawValue as any).cohesion)
      const grammar = Number.isFinite(task2) ? task2 : Number((rawValue as any).grammar)
      const timeSpentMinutes = Number((rawValue as any).timeSpentMinutes)
      const providedComment = typeof (rawValue as any).comment === 'string' ? String((rawValue as any).comment).trim() : ''
      const selected = Boolean((rawValue as any).selected)

      if (Number.isFinite(taskResponse) && Number.isFinite(cohesion) && Number.isFinite(grammar)) {
        const isExpertMarkMode = Number.isFinite(task11) && Number.isFinite(task12) && Number.isFinite(task2)
          && task11 >= 0 && task11 <= 5
          && task12 >= 0 && task12 <= 5
          && task2 >= 0 && task2 <= 7

        if (isExpertMarkMode) {
          const safeTask11 = Number(Math.max(0, Math.min(5, task11)).toFixed(1))
          const safeTask12 = Number(Math.max(0, Math.min(5, task12)).toFixed(1))
          const safeTask2 = Number(Math.max(0, Math.min(7, task2)).toFixed(1))
          const expertMark = Number((safeTask11 + safeTask12 + safeTask2).toFixed(1))
          const standardScore75 = WRITING_EXPERT_TO_STANDARD[expertMark.toFixed(1)]
            ?? WRITING_EXPERT_TO_STANDARD[String(Math.round(expertMark))]
            ?? 0
          const teacherPercent = Number(((standardScore75 / 75) * 100).toFixed(2))
          const scaledScore = Number(((teacherPercent / 100) * safeMax).toFixed(2))
          const taskResponsePercent = Number(((safeTask11 / 5) * 100).toFixed(2))
          const cohesionPercent = Number(((safeTask12 / 5) * 100).toFixed(2))
          const grammarPercent = Number(((safeTask2 / 7) * 100).toFixed(2))

          breakdown[category] = {
            score: scaledScore,
            maxScore: safeMax,
            percent: teacherPercent,
            comment: providedComment || `Task 1.1 ${safeTask11}/5, Task 1.2 ${safeTask12}/5, Task 2 ${safeTask2}/7, Expert ${expertMark}/17, Standard ${standardScore75}/75`,
            taskResponse: taskResponsePercent,
            cohesion: cohesionPercent,
            grammar: grammarPercent,
            task11: safeTask11,
            task12: safeTask12,
            task2: safeTask2,
            rawScore: expertMark,
            standardScore75,
            ...(selected ? { selected } : {}),
            ...(Number.isFinite(timeSpentMinutes) ? { timeSpentMinutes: Math.max(0, Math.round(timeSpentMinutes)) } : {})
          }
          continue
        }

        const safeTaskResponse = Math.max(0, Math.min(100, taskResponse))
        const safeCohesion = Math.max(0, Math.min(100, cohesion))
        const safeGrammar = Math.max(0, Math.min(100, grammar))
        const teacherPercent = Number((((safeTaskResponse + safeCohesion + safeGrammar) / 3)).toFixed(2))
        const scaledScore = Number(((teacherPercent / 100) * safeMax).toFixed(2))

        breakdown[category] = {
          score: scaledScore,
          maxScore: safeMax,
          percent: teacherPercent,
          comment: providedComment || `Task 1.1 ${safeTaskResponse}, Task 1.2 ${safeCohesion}, Task 2 ${safeGrammar}`,
          taskResponse: safeTaskResponse,
          cohesion: safeCohesion,
          grammar: safeGrammar,
          task11: safeTaskResponse,
          task12: safeCohesion,
          task2: safeGrammar,
          rawScore: teacherPercent,
          ...(selected ? { selected } : {}),
          ...(Number.isFinite(timeSpentMinutes) ? { timeSpentMinutes: Math.max(0, Math.round(timeSpentMinutes)) } : {})
        }
        continue
      }
    }

    if (category === 'speaking' && hasObjectValue) {
      const fluency = Number((rawValue as any).fluency)
      const lexical = Number((rawValue as any).lexical)
      const grammar = Number((rawValue as any).grammar)
      const pronunciation = Number((rawValue as any).pronunciation)
      const synonymBonus = Number((rawValue as any).synonymBonus)
      const cefrScore75 = Number((rawValue as any).cefrScore75)
      const levelDetected = typeof (rawValue as any).levelDetected === 'string' ? String((rawValue as any).levelDetected).trim() : ''
      const timeSpentMinutes = Number((rawValue as any).timeSpentMinutes)
      const providedComment = typeof (rawValue as any).comment === 'string' ? String((rawValue as any).comment).trim() : ''
      const selected = Boolean((rawValue as any).selected)

      if (Number.isFinite(fluency) && Number.isFinite(pronunciation)) {
        const isCefrScale = [fluency, lexical, grammar, pronunciation].every((value) => Number.isFinite(value) && value <= 25)
        const safeSynonymBonus = Number.isFinite(synonymBonus) ? Math.max(0, Math.min(10, synonymBonus)) : 0

        if (isCefrScale && Number.isFinite(lexical) && Number.isFinite(grammar)) {
          const safeFluency = Math.max(0, Math.min(25, fluency))
          const safeLexical = Math.max(0, Math.min(25, lexical))
          const safeGrammar = Math.max(0, Math.min(25, grammar))
          const safePronunciation = Math.max(0, Math.min(25, pronunciation))
          const score75 = Number.isFinite(cefrScore75)
            ? Math.max(0, Math.min(75, cefrScore75))
            : Math.max(0, Math.min(75, safeFluency + safeLexical + safeGrammar + safePronunciation + safeSynonymBonus))
          const sectionPercent = Number(((score75 / 75) * 100).toFixed(2))
          const scaledScore = Number(((sectionPercent / 100) * safeMax).toFixed(2))

          breakdown[category] = {
            score: scaledScore,
            maxScore: safeMax,
            percent: sectionPercent,
            comment: providedComment || `Fluency ${safeFluency}, Lexical ${safeLexical}, Grammar ${safeGrammar}, Pronunciation ${safePronunciation}, Synonym +${safeSynonymBonus}`,
            fluency: safeFluency,
            lexical: safeLexical,
            grammar: safeGrammar,
            pronunciation: safePronunciation,
            synonymBonus: safeSynonymBonus,
            cefrScore75: score75,
            ...(levelDetected ? { levelDetected } : {}),
            rawScore: sectionPercent,
            ...(selected ? { selected } : {}),
            ...(Number.isFinite(timeSpentMinutes) ? { timeSpentMinutes: Math.max(0, Math.round(timeSpentMinutes)) } : {})
          }
          continue
        }

        const safeFluency = Math.max(0, Math.min(100, fluency))
        const safePronunciation = Math.max(0, Math.min(100, pronunciation))
        const sectionPercent = Number((Math.min(100, ((safeFluency + safePronunciation) / 2) + safeSynonymBonus)).toFixed(2))
        const scaledScore = Number(((sectionPercent / 100) * safeMax).toFixed(2))

        breakdown[category] = {
          score: scaledScore,
          maxScore: safeMax,
          percent: sectionPercent,
          comment: providedComment || `Fluency ${safeFluency}, Pronunciation ${safePronunciation}, Synonym bonus +${safeSynonymBonus}`,
          fluency: safeFluency,
          pronunciation: safePronunciation,
          synonymBonus: safeSynonymBonus,
          rawScore: sectionPercent,
          ...(selected ? { selected } : {}),
          ...(levelDetected ? { levelDetected } : {}),
          ...(Number.isFinite(timeSpentMinutes) ? { timeSpentMinutes: Math.max(0, Math.round(timeSpentMinutes)) } : {})
        }
        continue
      }
    }

    if (category === 'attendance' && hasObjectValue) {
      const participationMode = String((rawValue as any).participationMode || '').trim().toLowerCase()
      const providedRawScore = Number((rawValue as any).rawScore)
      const providedComment = typeof (rawValue as any).comment === 'string' ? String((rawValue as any).comment).trim() : ''

      const modeMap: Record<string, { score: number; emoji: string; label: string; note: string }> = {
        super_active: { score: 20, emoji: '🔥', label: 'Super Active', note: 'Darsda juda faol qatnashdi va savollarga javob berdi.' },
        active: { score: 15, emoji: '✅', label: 'Active', note: 'Vazifalarni bajardi va darsda faol bo‘ldi.' },
        passive: { score: 5, emoji: '💤', label: 'Passive', note: 'Darsda e’tibor pasaydi, qo‘shimcha rag‘bat kerak.' },
      }

      const selectedMode = modeMap[participationMode]
      const rawScore = Number.isFinite(providedRawScore)
        ? Math.max(0, Math.min(20, providedRawScore))
        : (selectedMode ? selectedMode.score : NaN)

      if (Number.isFinite(rawScore)) {
        const attendancePercent = Number(((rawScore / 20) * 100).toFixed(2))
        const scaledScore = Number(((attendancePercent / 100) * safeMax).toFixed(2))
        const emoji = selectedMode?.emoji || ''
        const label = selectedMode?.label || 'Participation'
        const autoComment = selectedMode ? `${emoji} ${label}: ${selectedMode.note}` : 'Darsdagi faollik bo‘yicha baholandi.'

        breakdown[category] = {
          score: scaledScore,
          maxScore: safeMax,
          percent: attendancePercent,
          comment: providedComment || autoComment,
          participationMode: participationMode || undefined,
          participationEmoji: emoji || undefined,
          participationLabel: label,
          rawScore,
        }
        continue
      }
    }

    const score = Number(hasObjectValue ? (rawValue as any).score : rawValue)
    if (!Number.isFinite(score)) continue
    const bounded = Math.max(0, Math.min(score, safeMax))
    const sectionComment = hasObjectValue && typeof (rawValue as any).comment === 'string'
      ? String((rawValue as any).comment).trim()
      : ''
    breakdown[category] = {
      score: bounded,
      maxScore: safeMax,
      percent: Number(((bounded / safeMax) * 100).toFixed(2)),
      ...(sectionComment ? { comment: sectionComment } : {})
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

function applyPronunciationBonus(overallPercent: number, breakdown: Record<string, any>, body: any) {
  const vocab = breakdown?.vocabulary
  const hasBonus = Boolean(vocab?.pronunciationBonus ?? body?.pronunciationBonus)
  if (!hasBonus) return overallPercent
  return Number(Math.min(100, Number(overallPercent || 0) + 5).toFixed(2))
}

async function enrichIntermediateBreakdownWithAi(breakdown: Record<string, any>, maxScore: number) {
  const writing = breakdown?.writing
  if (!writing || typeof writing !== 'object') return breakdown

  const taskResponse = Number(writing?.taskResponse ?? writing?.task11)
  const cohesion = Number(writing?.cohesion ?? writing?.task12)
  const grammar = Number(writing?.grammar ?? writing?.task2)

  if (!Number.isFinite(taskResponse) || !Number.isFinite(cohesion) || !Number.isFinite(grammar)) {
    return breakdown
  }

  const insights = await buildIntermediateWritingInsights({
    taskResponse: Math.max(0, Math.min(100, taskResponse)),
    cohesion: Math.max(0, Math.min(100, cohesion)),
    grammar: Math.max(0, Math.min(100, grammar)),
  })

  const teacherPercent = Number(writing?.percent ?? writing?.rawScore ?? 0)
  const aiAverage = (insights.grammarAccuracy + insights.lexicalResource) / 2
  const blendedPercent = Number(((teacherPercent * 0.7) + (aiAverage * 0.3)).toFixed(2))
  const safeMax = Number(maxScore || writing?.maxScore || 100) > 0 ? Number(maxScore || writing?.maxScore || 100) : 100
  const blendedScore = Number(((blendedPercent / 100) * safeMax).toFixed(2))
  const previousComment = typeof writing?.comment === 'string' ? String(writing.comment).trim() : ''

  breakdown.writing = {
    ...writing,
    score: blendedScore,
    maxScore: safeMax,
    percent: blendedPercent,
    rawScore: blendedPercent,
    grammarAccuracy: insights.grammarAccuracy,
    lexicalResource: insights.lexicalResource,
    mistakeLogger: insights.mistakes,
    comment: [
      previousComment,
      `Kevin AI — Grammar accuracy: ${insights.grammarAccuracy}%, Lexical resource: ${insights.lexicalResource}%.`,
      `Mistake logger: ${insights.mistakes.join(', ')}`,
    ].filter(Boolean).join(' '),
  }

  return breakdown
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
    const studentId = await resolveStudentId({ ...body, adminId })
    const scoreType = (body.scoreType === 'mock' ? 'mock' : 'weekly') as ScoreType
    const level = normalizeLevel(body.level)
    const maxScore = Number(body.maxScore || 100)
    const breakdown = extractBreakdown(body, level, maxScore)
    if (level === 'intermediate') {
      await enrichIntermediateBreakdownWithAi(breakdown as Record<string, any>, maxScore)
    }

    let overallPercent =
      typeof body.overallPercent === 'number'
        ? Number(body.overallPercent)
        : calculateOverallPercent(breakdown, Number(body.value || 0))
    let overallWithBonus = applyPronunciationBonus(overallPercent, breakdown, body)

    if (!Number.isFinite(overallWithBonus) || overallWithBonus <= 0) {
      return NextResponse.json({ error: 'Ball 0% dan katta bo‘lishi kerak' }, { status: 400 })
    }

    const examDateTime = scoreType === 'mock' ? buildExamDateTime(body) : null
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''

    const score = await prisma.score.create({
      data: {
        adminId,
        studentId,
        value: overallWithBonus,
        subject: body.subject || (scoreType === 'mock' ? 'MOCK imtihon' : 'Baholash'),
        comment: comment || null,
        level,
        category: body.category || 'overall',
        scoreType,
        maxScore: Number(body.maxScore || 100),
        overallPercent: overallWithBonus,
        mockScore: scoreType === 'mock' ? overallWithBonus : null,
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
      const scoreValue = Number(overallWithBonus || 0)
      const grammarBreakdown = (breakdown as any)?.grammar
      const intermediateBreakdown = breakdown as any
      const hasIntermediateTrack = level === 'intermediate'
        && ['listening', 'reading', 'writing', 'speaking'].some((key) => Boolean(intermediateBreakdown?.[key]))

      const aiSummary = hasIntermediateTrack
        ? await buildIntermediateParentSummary({
            studentName: studentWithGroup?.fullName || student?.fullName || "O‘quvchi",
            listening: Number(intermediateBreakdown?.listening?.percent ?? 0),
            reading: Number(intermediateBreakdown?.reading?.percent ?? 0),
            writing: Number(intermediateBreakdown?.writing?.percent ?? 0),
            speaking: Number(intermediateBreakdown?.speaking?.percent ?? 0),
            timeSpentMinutes: Number(intermediateBreakdown?.listening?.timeSpentMinutes ?? intermediateBreakdown?.reading?.timeSpentMinutes ?? intermediateBreakdown?.writing?.timeSpentMinutes ?? 0),
          })
        : grammarBreakdown
          ? await buildGrammarParentSummary({
              studentName: studentWithGroup?.fullName || student?.fullName || "O‘quvchi",
              grammarTopic: String(grammarBreakdown?.grammarTopic || ''),
              sentenceStructure: Number(grammarBreakdown?.sentenceStructure ?? 0),
              topicMastery: Number(grammarBreakdown?.topicMastery ?? grammarBreakdown?.toBeTenses ?? 0),
              spelling: Number(grammarBreakdown?.spelling ?? 0),
            })
          : ''

      await sendScoreNotification({
        adminId,
        studentId,
        studentName: studentWithGroup?.fullName || student?.fullName || "O‘quvchi",
        subject,
        scorePercent: scoreValue,
        maxScore: Number(body.maxScore || 100),
        rank: rankingData.rank || 0,
        leaderboard: rankingData.leaderboard,
        breakdown: breakdown as Record<string, any>,
        vocabularyWordList: Array.isArray((breakdown as any)?.vocabulary?.wordList)
          ? (breakdown as any).vocabulary.wordList
          : [],
        vocabularySourceWordList: Array.isArray((breakdown as any)?.vocabulary?.sourceWordList)
          ? (breakdown as any).vocabulary.sourceWordList
          : [],
        aiSummary,
      })
    }

    return NextResponse.json({ ...score, studentName: student?.fullName })
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
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

    const studentId = await resolveStudentId({ ...body, adminId })
    const scoreType = (body.scoreType === 'mock' ? 'mock' : 'weekly') as ScoreType
    const level = normalizeLevel(body.level)
    const maxScore = Number(body.maxScore || 100)
    const breakdown = extractBreakdown(body, level, maxScore)
    if (level === 'intermediate') {
      await enrichIntermediateBreakdownWithAi(breakdown as Record<string, any>, maxScore)
    }

    let overallPercent =
      typeof body.overallPercent === 'number'
        ? Number(body.overallPercent)
        : calculateOverallPercent(breakdown, Number(body.value || 0))
    let overallWithBonus = applyPronunciationBonus(overallPercent, breakdown, body)

    if (!Number.isFinite(overallWithBonus) || overallWithBonus <= 0) {
      return NextResponse.json({ error: 'Ball 0% dan katta bo‘lishi kerak' }, { status: 400 })
    }

    const examDateTime = scoreType === 'mock' ? buildExamDateTime(body) : null
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''

    const data = {
      studentId,
      value: overallWithBonus,
      subject: body.subject || (scoreType === 'mock' ? 'MOCK EXAM' : 'Weekly Assessment'),
      comment: comment || null,
      level,
      category: body.category || 'overall',
      scoreType,
      maxScore: Number(body.maxScore || 100),
      overallPercent: overallWithBonus,
      mockScore: scoreType === 'mock' ? overallWithBonus : null,
      examDateTime,
      breakdown
    }

    const score = await prisma.score.update({ where: { id }, data })
    const student = score.studentId ? await prisma.student.findUnique({ where: { id: score.studentId }, select: { fullName: true } }) : null
    return NextResponse.json({ ...score, studentName: student?.fullName })
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
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
