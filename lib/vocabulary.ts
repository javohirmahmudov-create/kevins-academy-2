/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from 'crypto'

export type WordPair = {
  wordId: string
  promptUz: string
  answerEn: string
  raw: string
}

export type WordState = {
  wordId: string
  promptUz: string
  answerEn: string
  attempts: number
  streak: number
  lastCorrect: boolean
  mastered: boolean
  due: boolean
  nextReviewAt: string
}

type AttemptItem = {
  wordId: string
  expected: string
  correct: boolean
  createdAt: string
}

const HASH_SALT = process.env.VOCAB_HASH_SALT || process.env.NEXTAUTH_SECRET || 'kevins-academy-vocab'

function normalizeToken(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘ʻʼ]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, '')
    .replace(/\s+/g, ' ')
}

function levenshteinDistance(left: string, right: string) {
  const a = normalizeToken(left)
  const b = normalizeToken(right)
  if (!a) return b.length
  if (!b) return a.length
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }
  return dp[a.length][b.length]
}

function parseWordPair(rawInput: string): Omit<WordPair, 'wordId'> {
  const cleaned = String(rawInput || '')
    .replace(/^\s*\d+[\)\].:\-\s]+/, '')
    .trim()

  const separators = ['=>', '->', '|', ':', ' - ', ' — ', ' – ']
  for (const separator of separators) {
    const index = cleaned.indexOf(separator)
    if (index > 0) {
      const left = cleaned.slice(0, index).trim()
      const right = cleaned.slice(index + separator.length).trim()
      if (left && right) {
        return { promptUz: left, answerEn: right, raw: cleaned }
      }
    }
  }

  return {
    promptUz: cleaned,
    answerEn: cleaned,
    raw: cleaned,
  }
}

export function buildWordId(answerEn: string) {
  return createHash('sha256')
    .update(`${HASH_SALT}:${normalizeToken(answerEn)}`)
    .digest('hex')
    .slice(0, 16)
}

export function isAnswerCorrect(answer: string, expected: string) {
  const normalizedAnswer = normalizeToken(answer)
  const normalizedExpected = normalizeToken(expected)
  if (!normalizedAnswer || !normalizedExpected) return false
  if (normalizedAnswer === normalizedExpected) return true
  if (normalizedExpected.length >= 6) {
    return levenshteinDistance(normalizedAnswer, normalizedExpected) <= 1
  }
  return false
}

export function extractDeckFromScores(scores: Array<{ breakdown: any }>) {
  const unique = new Map<string, WordPair>()

  for (const score of scores || []) {
    const breakdown = score?.breakdown && typeof score.breakdown === 'object' ? score.breakdown : null
    const vocabulary = breakdown?.vocabulary && typeof breakdown.vocabulary === 'object' ? breakdown.vocabulary : null
    if (!vocabulary) continue

    const sourceWordList = Array.isArray(vocabulary.sourceWordList) ? vocabulary.sourceWordList : []
    const wordList = Array.isArray(vocabulary.wordList) ? vocabulary.wordList : []
    const merged = [...sourceWordList, ...wordList]

    for (const entry of merged) {
      const parsed = parseWordPair(String(entry || '').trim())
      if (!parsed.answerEn) continue
      const key = normalizeToken(parsed.answerEn)
      if (!key || unique.has(key)) continue
      unique.set(key, {
        ...parsed,
        wordId: buildWordId(parsed.answerEn),
      })
    }
  }

  return Array.from(unique.values())
}

export function extractAttemptsFromScores(scores: Array<{ breakdown: any; createdAt?: Date | string }>) {
  const attempts: AttemptItem[] = []

  for (const score of scores || []) {
    const breakdown = score?.breakdown && typeof score.breakdown === 'object' ? score.breakdown : null
    const proctor = breakdown?.vocabularyProctor && typeof breakdown.vocabularyProctor === 'object' ? breakdown.vocabularyProctor : null
    const answers = Array.isArray(proctor?.answers) ? proctor.answers : []
    const createdAt = new Date(score?.createdAt || Date.now()).toISOString()

    for (const answer of answers) {
      const expected = String(answer?.expected || '').trim()
      const wordId = buildWordId(expected)
      if (!expected || !wordId) continue
      attempts.push({
        wordId,
        expected,
        correct: Boolean(answer?.correct),
        createdAt,
      })
    }
  }

  return attempts
}

function addDays(baseIso: string, days: number) {
  const date = new Date(baseIso)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function buildWordStates(input: { deck: WordPair[]; attempts: AttemptItem[]; now?: Date }) {
  const now = input.now || new Date()
  const byWord = new Map<string, AttemptItem[]>()

  for (const item of input.attempts) {
    const arr = byWord.get(item.wordId) || []
    arr.push(item)
    byWord.set(item.wordId, arr)
  }

  for (const arr of byWord.values()) {
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const states: WordState[] = input.deck.map((word) => {
    const history = byWord.get(word.wordId) || []
    const attempts = history.length
    const last = history[0]
    const lastCorrect = last ? Boolean(last.correct) : false

    let streak = 0
    for (const row of history) {
      if (!row.correct) break
      streak += 1
    }

    let nextReviewAt = now.toISOString()
    if (last) {
      if (!last.correct) nextReviewAt = addDays(last.createdAt, 1)
      else if (streak >= 3) nextReviewAt = addDays(last.createdAt, 7)
      else if (streak === 2) nextReviewAt = addDays(last.createdAt, 3)
      else nextReviewAt = addDays(last.createdAt, 1)
    }

    const due = new Date(nextReviewAt).getTime() <= now.getTime()
    const mastered = lastCorrect && streak >= 2

    return {
      wordId: word.wordId,
      promptUz: word.promptUz,
      answerEn: word.answerEn,
      attempts,
      streak,
      lastCorrect,
      mastered,
      due,
      nextReviewAt,
    }
  })

  return states
}

export function createQuizFromStates(states: WordState[], size: number) {
  const dueWords = states.filter((item) => item.due)
  const rest = states.filter((item) => !item.due)

  const shuffle = <T>(items: T[]) => [...items].sort(() => Math.random() - 0.5)
  const ordered = [...shuffle(dueWords), ...shuffle(rest)]

  return ordered.slice(0, Math.max(1, size)).map((item) => ({
    wordId: item.wordId,
    promptUz: item.promptUz,
  }))
}
