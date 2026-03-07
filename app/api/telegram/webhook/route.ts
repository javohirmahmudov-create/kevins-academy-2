import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { answerTelegramCallbackQuery, normalizePhoneForLinking, sendTelegramContactCard, sendTelegramContactRequestMessage, sendTelegramMessage, updateParentBotStatusByChatId, upsertTelegramPhoneLink } from '@/lib/telegram'

const AI_MIN_INTERVAL_MS = Number(process.env.TELEGRAM_AI_MIN_INTERVAL_MS || 3000)
const AI_COOLDOWN_CACHE_LIMIT = 5000
const aiRequestCooldownByChat = new Map<string, number>()
const DEFAULT_CARD_NUMBER = '9860 3501 4447 3575'

type StudentInsightSnapshot = {
  parentName: string
  studentName: string
  group: string
  level: string
  attendanceRate: number
  latestScore: number
  weeklyRank: number
  mockRank: number
  lastPaymentStatus: string
  lastAttendance: string
  lastLateNote: string
  lateCount14d: number
  absentCount14d: number
  scoreTrend: 'up' | 'down' | 'stable'
  skills: SkillInsight[]
}

type SkillInsight = {
  key: string
  label: string
  score: number
  maxScore: number
  percent: number
  comment?: string
  selected?: boolean
  weakestPart?: string
  listeningParts?: Record<string, number>
  readingParts?: Record<string, number>
  task11?: number
  task12?: number
  task2?: number
  cefrScore75?: number
  levelDetected?: string
  lexical?: number
  speakingGrammar?: number
  speakingPronunciation?: number
  synonymBonus?: number
  wordList?: string[]
  sourceWordList?: string[]
  sentenceStructure?: number
  topicMastery?: number
  toBeTenses?: number
  spelling?: number
}

const SKILL_ALIASES: Record<string, string[]> = {
  listening: ['listening', 'eshitish', 'tinglab', 'tinglash'],
  reading: ['reading', 'o\'qish', 'oqish', 'matn'],
  speaking: ['speaking', 'gapirish', 'og\'zaki', 'ogzaki'],
  writing: ['writing', 'yozish', 'yozma'],
  grammar: ['grammar', 'grammatika'],
  vocabulary: ['vocabulary', 'lug\'at', 'lugat', 'word'],
  translation: ['translation', 'tarjima', 'o\'qish matn', 'matn tarjimasi'],
  attendance: ['attendance', 'davomat'],
}

const SKILL_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  speaking: 'Speaking',
  writing: 'Writing',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  translation: 'Translation',
  attendance: 'Attendance',
}

function normalizeLevel(raw?: string | null) {
  const value = String(raw || '').trim().toLowerCase()
  if (value.includes('advanced')) return 'advanced'
  if (value.includes('intermediate')) return 'intermediate'
  if (value.includes('elementary')) return 'elementary'
  return 'beginner'
}

function getSnapshotTrack(snapshot: StudentInsightSnapshot) {
  const normalizedLevel = normalizeLevel(snapshot.level)
  if (normalizedLevel === 'intermediate' || normalizedLevel === 'advanced') {
    return 'intermediate' as const
  }

  const advancedSkillSet = ['listening', 'reading', 'writing', 'speaking']
  const hasAdvancedSkills = advancedSkillSet.every((key) => snapshot.skills.some((item) => item.key === key))
  return hasAdvancedSkills ? ('intermediate' as const) : ('beginner' as const)
}

function getWeakestSkill(snapshot: StudentInsightSnapshot) {
  if (!snapshot.skills.length) return null
  return [...snapshot.skills].sort((a, b) => a.percent - b.percent)[0]
}

function getSectionButtonsForTrack(track: 'beginner' | 'intermediate') {
  if (track === 'intermediate') {
    return [
      { text: '🎧 Listening diagnostika', callbackData: 'kevin_section_listening' },
      { text: '📚 Reading diagnostika', callbackData: 'kevin_section_reading' },
      { text: '✍️ Writing diagnostika', callbackData: 'kevin_section_writing' },
      { text: '🗣 Speaking diagnostika', callbackData: 'kevin_section_speaking' },
    ]
  }

  return [
    { text: '🧩 Grammar topic', callbackData: 'kevin_section_grammar' },
    { text: '🧠 Vocabulary muammoni hal qilish', callbackData: 'kevin_section_vocabulary' },
    { text: '📅 Qatnashuv bo‘yicha fikr', callbackData: 'kevin_section_attendance' },
    { text: '📖 O‘qish / Tarjima feedback', callbackData: 'kevin_section_translation' },
  ]
}

function checkAndSetAiCooldown(chatId: string) {
  const now = Date.now()
  const cooldown = Number.isFinite(AI_MIN_INTERVAL_MS) && AI_MIN_INTERVAL_MS > 0 ? AI_MIN_INTERVAL_MS : 8000
  const lastAt = aiRequestCooldownByChat.get(chatId) || 0
  const diff = now - lastAt

  if (diff < cooldown) {
    return { ok: false as const, waitMs: cooldown - diff }
  }

  aiRequestCooldownByChat.set(chatId, now)

  if (aiRequestCooldownByChat.size > AI_COOLDOWN_CACHE_LIMIT) {
    const threshold = now - Math.max(cooldown * 5, 60_000)
    for (const [key, value] of aiRequestCooldownByChat) {
      if (value < threshold) {
        aiRequestCooldownByChat.delete(key)
      }
    }
  }

  return { ok: true as const, waitMs: 0 }
}

function isStartCommand(text: string) {
  return /^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(String(text || '').trim())
}

async function resolveParentByChatId(chatId: string) {
  const parents = await prisma.parent.findMany({ orderBy: { createdAt: 'desc' } })

  for (const parent of parents) {
    const unpacked = unpackParent(parent) as any
    if (String(unpacked?.telegramChatId || '') === String(chatId)) {
      return { raw: parent, unpacked }
    }
  }

  try {
    const telegramLinkDelegate = (prisma as any).telegramLink
    if (!telegramLinkDelegate) return null

    const linkRow = await telegramLinkDelegate.findFirst({
      where: { chatId: String(chatId) },
      orderBy: { lastSeenAt: 'desc' }
    })

    if (!linkRow?.phoneNormalized) return null

    for (const parent of parents) {
      const unpacked = unpackParent(parent) as any
      const normalizedParentPhone = normalizePhoneForLinking(unpacked?.phone || parent.phone)
      if (normalizedParentPhone && normalizedParentPhone === String(linkRow.phoneNormalized)) {
        return { raw: parent, unpacked }
      }
    }

    return null
  } catch {
    return null
  }
}

async function sendRecentScoreHistoryToParent(input: { chatId: string; parentRow: any; unpacked: any }) {
  const studentId = Number(input.unpacked?.studentId || 0)
  if (!Number.isFinite(studentId) || studentId <= 0) return

  const scoreRows = await prisma.score.findMany({
    where: {
      ...(input.parentRow?.adminId ? { adminId: Number(input.parentRow.adminId) } : {}),
      studentId,
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      scoreType: true,
      overallPercent: true,
      createdAt: true,
      subject: true,
    },
  })

  if (!scoreRows.length) return

  const historyLines = scoreRows.map((row, index) => {
    const typeLabel = String(row.scoreType || '').toLowerCase() === 'mock' ? 'MOCK' : 'WEEKLY'
    const percent = Number(row.overallPercent || 0).toFixed(1)
    const date = row.createdAt ? new Date(row.createdAt).toLocaleDateString('uz-UZ') : '-'
    return `${index + 1}) ${typeLabel} · ${percent}% · ${date}`
  })

  await sendTelegramMessage({
    chatId: input.chatId,
    text: `🧾 <b>So‘nggi natijalar tarixi</b>\n\n${historyLines.join('\n')}`,
    modeButtons: true,
  })
}

function normalizeQuestion(question: string) {
  return String(question || '').trim().toLowerCase()
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function isBotAllowedQuestion(question: string) {
  const normalized = normalizeQuestion(question)
  return /(davomat|qatnash|kechik|ball|reyting|tolov|to'lov|toʻlov|payment|listening|reading|speaking|writing|grammar|vocabulary|translation|attendance|reja|plan|youtube|link|uyga vazifa|homework|holat)/.test(normalized)
}

function scoreTrendFromRows(rows: Array<{ overallPercent?: number | null; value?: number | null }>) {
  if (!rows.length) return 'stable' as const
  const ordered = [...rows].reverse().map((item) => Number(item.overallPercent ?? item.value ?? 0))
  if (ordered.length < 2) return 'stable' as const
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const diff = last - first
  if (diff >= 5) return 'up' as const
  if (diff <= -5) return 'down' as const
  return 'stable' as const
}

function extractSkillInsights(scores: Array<{ breakdown?: any }>) {
  const first = scores[0]
  const raw = first?.breakdown
  if (!raw || typeof raw !== 'object') return [] as SkillInsight[]

  return Object.entries(raw as Record<string, any>)
    .map(([key, value]) => {
      const score = Number((value as any)?.score ?? 0)
      const maxScore = Number((value as any)?.maxScore ?? 100)
      const percentFromPayload = Number((value as any)?.percent)
      const percent = Number.isFinite(percentFromPayload)
        ? percentFromPayload
        : (maxScore > 0 ? Number(((score / maxScore) * 100).toFixed(2)) : 0)

      return {
        key,
        label: SKILL_LABEL[key] || key,
        score,
        maxScore,
        percent,
        comment: typeof (value as any)?.comment === 'string' ? String((value as any).comment).trim() : '',
        selected: Boolean((value as any)?.selected),
        weakestPart: typeof (value as any)?.weakestPart === 'string' ? String((value as any).weakestPart).trim() : '',
        listeningParts: (value as any)?.listeningParts && typeof (value as any).listeningParts === 'object'
          ? Object.entries((value as any).listeningParts as Record<string, any>).reduce((acc, [partKey, partValue]) => {
              const parsed = Number(partValue)
              if (Number.isFinite(parsed)) acc[partKey] = parsed
              return acc
            }, {} as Record<string, number>)
          : undefined,
        readingParts: (value as any)?.readingParts && typeof (value as any).readingParts === 'object'
          ? Object.entries((value as any).readingParts as Record<string, any>).reduce((acc, [partKey, partValue]) => {
              const parsed = Number(partValue)
              if (Number.isFinite(parsed)) acc[partKey] = parsed
              return acc
            }, {} as Record<string, number>)
          : undefined,
        task11: Number.isFinite(Number((value as any)?.task11)) ? Number((value as any).task11) : undefined,
        task12: Number.isFinite(Number((value as any)?.task12)) ? Number((value as any).task12) : undefined,
        task2: Number.isFinite(Number((value as any)?.task2)) ? Number((value as any).task2) : undefined,
        cefrScore75: Number.isFinite(Number((value as any)?.cefrScore75)) ? Number((value as any).cefrScore75) : undefined,
        levelDetected: typeof (value as any)?.levelDetected === 'string' ? String((value as any).levelDetected).trim() : '',
        lexical: Number.isFinite(Number((value as any)?.lexical)) ? Number((value as any).lexical) : undefined,
        speakingGrammar: Number.isFinite(Number((value as any)?.grammar)) ? Number((value as any).grammar) : undefined,
        speakingPronunciation: Number.isFinite(Number((value as any)?.pronunciation)) ? Number((value as any).pronunciation) : undefined,
        synonymBonus: Number.isFinite(Number((value as any)?.synonymBonus)) ? Number((value as any).synonymBonus) : undefined,
        wordList: Array.isArray((value as any)?.wordList)
          ? (value as any).wordList.map((item: any) => String(item || '').trim()).filter(Boolean)
          : [],
        sourceWordList: Array.isArray((value as any)?.sourceWordList)
          ? (value as any).sourceWordList.map((item: any) => String(item || '').trim()).filter(Boolean)
          : [],
        sentenceStructure: Number.isFinite(Number((value as any)?.sentenceStructure))
          ? Number((value as any).sentenceStructure)
          : undefined,
        topicMastery: Number.isFinite(Number((value as any)?.topicMastery ?? (value as any)?.toBeTenses))
          ? Number((value as any).topicMastery ?? (value as any).toBeTenses)
          : undefined,
        toBeTenses: Number.isFinite(Number((value as any)?.topicMastery ?? (value as any)?.toBeTenses))
          ? Number((value as any).topicMastery ?? (value as any).toBeTenses)
          : undefined,
        spelling: Number.isFinite(Number((value as any)?.spelling))
          ? Number((value as any).spelling)
          : undefined,
      }
    })
    .filter((item) => Number.isFinite(item.percent))
}

function inferQuestionSkill(question: string, skills: SkillInsight[]) {
  const mentionedSkillKey = getMentionedSkillKey(question, skills)
  if (mentionedSkillKey) return mentionedSkillKey

  const normalized = normalizeQuestion(question)
  const available = new Set(skills.map((item) => item.key))

  if (available.has('vocabulary') && /(bilmagan|soz|so\'z|lugat|lug\'at|word)/.test(normalized)) return 'vocabulary'
  if (available.has('grammar') && /(xato gap|gap tuz|gramm|tense|to be|article|preposition)/.test(normalized)) return 'grammar'
  if (available.has('attendance') && /(davomat|kechik|qatnash|kelma|absent|late)/.test(normalized)) return 'attendance'
  if (available.has('translation') && /(tarjima|matn|o\'qish|oqish|translation|reading)/.test(normalized)) return 'translation'
  if (available.has('reading') && /(tarjima|matn|o\'qish|oqish|reading)/.test(normalized)) return 'reading'

  return ''
}

function getUnknownVocabularyWords(skill?: SkillInsight | null) {
  if (!skill) return [] as string[]
  const known = new Set((skill.wordList || []).map((word) => String(word || '').trim().toLowerCase()).filter(Boolean))
  const source = (skill.sourceWordList || []).map((word) => String(word || '').trim()).filter(Boolean)
  const unknown = source.filter((word) => !known.has(word.toLowerCase()))
  return Array.from(new Set(unknown))
}

function buildExampleSentenceForWord(word: string, index: number) {
  const cleaned = String(word || '').trim().replace(/\s+/g, ' ')
  const safeWord = cleaned || 'word'
  const templates = [
    `I use the word "${safeWord}" in my homework today.`,
    `My teacher asked me to say "${safeWord}" clearly in class.`,
    `I can write "${safeWord}" in a correct sentence now.`,
    `At home, I repeat "${safeWord}" three times before sleep.`,
    `Tomorrow I will use "${safeWord}" when I speak English.`,
  ]
  return templates[index % templates.length]
}

function getMentionedSkillKey(question: string, skills: Array<{ key: string }>) {
  const normalized = normalizeQuestion(question)
  const allowed = new Set(skills.map((item) => item.key))

  for (const [skill, aliases] of Object.entries(SKILL_ALIASES)) {
    if (!allowed.has(skill)) continue
    if (aliases.some((alias) => normalized.includes(alias))) {
      return skill
    }
  }

  return ''
}

function buildYouTubeLinksForSkill(skillKey: string) {
  const queries: Record<string, string[]> = {
    listening: ['IELTS listening practice B1 B2', 'English listening practice with answers'],
    reading: ['IELTS reading strategies band 6', 'English reading comprehension B1 B2'],
    speaking: ['IELTS speaking part 1 2 3 sample answers', 'English speaking practice daily topics'],
    writing: ['IELTS writing task 2 tips', 'English paragraph writing for intermediate'],
    grammar: ['English grammar in use intermediate', 'Present perfect vs past simple exercises'],
    vocabulary: ['English vocabulary for daily conversation', 'B1 B2 vocabulary practice'],
    translation: ['English Uzbek translation practice', 'How to improve translation skills English'],
    attendance: ['study routine consistency tips', 'how to build study discipline'],
  }

  const selected = queries[skillKey] || ['English learning tips', 'study skills for students']
  return selected.map((query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`)
}

function buildWeeklyPlanForSkill(skillKey: string) {
  const plans: Record<string, string[]> = {
    listening: [
      'Dushanba: 25 daqiqa audio + 10 ta kalit so‘z yozib olish',
      'Seshanba: 30 daqiqa listening test (qisqa dialoglar)',
      'Chorshanba: xato savollarni qayta tahlil (20 daqiqa)',
      'Payshanba: 25 daqiqa dictation (eshitib yozish)',
      'Juma: 30 daqiqa mixed listening practice',
      'Shanba: 15 daqiqa tezkor mini-test',
      'Yakshanba: 10 daqiqa progress review',
    ],
    reading: [
      'Dushanba: 20 daqiqa skimming/scanning mashqi',
      'Seshanba: 30 daqiqa reading passage + savollar',
      'Chorshanba: notanish so‘zlar lug‘atini tuzish',
      'Payshanba: 25 daqiqa time-limited reading',
      'Juma: 30 daqiqa inference savollari',
      'Shanba: 15 daqiqa mini-test',
      'Yakshanba: xatolarni qayta ko‘rish',
    ],
    speaking: [
      'Har kuni: 15 daqiqa ovoz yozib gapirish (topic-based)',
      '3 kun: 10 ta savolga 1 daqiqadan javob',
      '2 kun: pronunciation drill (minimal pairs)',
      '1 kun: role-play mashqi',
      'Yakshanba: self-review va qayta yozib ko‘rish',
    ],
    writing: [
      'Dushanba: 1 ta paragraf (80-120 so‘z)',
      'Seshanba: grammar correction mashqi',
      'Chorshanba: linking words bo‘yicha mashq',
      'Payshanba: task rewrite (oldin/hozir solishtirish)',
      'Juma: 1 ta full writing task',
      'Shanba: teacher/ota-ona bilan tekshiruv',
      'Yakshanba: xatolar ro‘yxatini yangilash',
    ],
    grammar: [
      'Har kuni: 20 daqiqa bitta mavzu (tense/article/preposition)',
      '3 kun: 25 ta test savoli',
      '2 kun: xatolar bo‘yicha qayta mashq',
      'Yakshanba: umumiy grammar mini-test',
    ],
    vocabulary: [
      'Har kuni: 12-15 ta yangi so‘z + gapda ishlatish',
      '3 kun: flashcard takrorlash',
      '2 kun: synonym/antonym mashqi',
      'Yakshanba: 50 so‘zli quiz',
    ],
    translation: [
      'Har kuni: 15 daqiqa 5-7 gap tarjima',
      '3 kun: mavzuli matn tarjimasi',
      '2 kun: xatolarni qayta yozish',
      'Yakshanba: oldingi tarjimalarni solishtirish',
    ],
    attendance: [
      'Har dars kuni: chiqish vaqtini 20 daqiqa oldin rejalash',
      'Hafta davomida: kelish/check-list nazorati',
      'Yakshanba: qatnashuv tahlili va keyingi hafta rejasi',
    ],
  }

  return plans[skillKey] || [
    'Har kuni: 25 daqiqa maqsadli mashq',
    'Hafta oxiri: mini-test va xatolar tahlili',
  ]
}

function buildHomeworkSuggestions(skillKey: string) {
  const homeworks: Record<string, string[]> = {
    listening: [
      'Uyga vazifa 1: 15 daqiqalik audio eshitib 5 ta asosiy g‘oyani yozing.',
      'Uyga vazifa 2: 10 ta listening savoliga time-limit bilan javob bering.',
    ],
    reading: [
      'Uyga vazifa 1: 1 ta maqola o‘qib 8 ta savolga javob yozing.',
      'Uyga vazifa 2: 12 ta yangi so‘z uchun misol gap tuzing.',
    ],
    speaking: [
      'Uyga vazifa 1: “My day” mavzusida 2 daqiqa audio yozing.',
      'Uyga vazifa 2: 5 ta savol-javobni oynaga qarab mashq qiling.',
    ],
    writing: [
      'Uyga vazifa 1: 120 so‘zli paragraf yozing (topic beriladi).',
      'Uyga vazifa 2: 10 ta gapni grammar bo‘yicha to‘g‘rilang.',
    ],
    grammar: [
      'Uyga vazifa 1: tanlangan grammar mavzusidan 30 ta test.',
      'Uyga vazifa 2: xato bo‘lgan 10 gapni qayta yozing.',
    ],
    vocabulary: [
      'Uyga vazifa 1: 20 ta yangi so‘z uchun tarjima + misol.',
      'Uyga vazifa 2: shu so‘zlar bilan 10 ta gap yozing.',
    ],
    translation: [
      'Uyga vazifa 1: 8 ta gapni EN↔UZ tarjima qiling.',
      'Uyga vazifa 2: 1 ta qisqa matnni tarjima qilib tekshiring.',
    ],
    attendance: [
      'Uyga vazifa 1: ertangi dars uchun tayyor checklist tuzing.',
      'Uyga vazifa 2: kechikish sabablarini 3 bandda yozib yechim belgilang.',
    ],
  }

  return homeworks[skillKey] || [
    'Uyga vazifa 1: bugungi dars bo‘yicha 25 daqiqa takrorlash.',
    'Uyga vazifa 2: 10 ta test savoli ishlash.',
  ]
}

function buildPartSpecificRecommendations(skill: SkillInsight) {
  const weakestPart = String(skill.weakestPart || '').toLowerCase()
  const key = skill.key

  if (key === 'listening') {
    if (weakestPart.includes('part 3') || weakestPart.includes('part 5')) {
      return [
        'Map/matching savollar uchun avval variantlarni tez ko‘zdan kechiring, keyin audio paytida keyword belgilang.',
        'Distractorlarni ajratish uchun har testdan keyin “nega shu javob noto‘g‘ri” deb 3 ta izoh yozing.',
        'Part 3/5 uchun haftasiga 3 marta 12 savollik timed drill ishlang.',
      ]
    }
    if (weakestPart.includes('part 6')) {
      return [
        'Long lecture uchun note-taking shablonidan foydalaning: sabab → natija → misol.',
        'Har listeningdan keyin 5 ta signal phrase yozib chiqing (however, therefore, in contrast).',
        'Part 6 bo‘yicha haftasiga 2 marta 15 daqiqalik focused practice qiling.',
      ]
    }
  }

  if (key === 'reading') {
    if (weakestPart.includes('part 2') || weakestPart.includes('part 4')) {
      return [
        'Skimmingni 90 soniyada yakunlab, har paragrafga 2-3 so‘zli heading qo‘ying.',
        'Paraphrase signal so‘zlarini ajratish uchun matndan synonym juftliklar ro‘yxatini tuzing.',
        'Part 2/4 uchun haftasiga 3 marta 10 savollik speed-drill ishlang.',
      ]
    }
    if (weakestPart.includes('part 5')) {
      return [
        'Inference savollarida dalil bo‘lgan 1-2 satrni marker bilan belgilang.',
        'Har testdan keyin “evidence sentence” daftarini yuriting.',
        'Part 5 uchun haftasiga 2 marta 20 daqiqalik tahliliy reading qiling.',
      ]
    }
  }

  if (key === 'writing' && Number.isFinite(skill.task2)) {
    const weakTask = (Number(skill.task2) <= Number(skill.task11 || 100) && Number(skill.task2) <= Number(skill.task12 || 100))
      ? 'Task 2'
      : (Number(skill.task11 || 100) <= Number(skill.task12 || 100) ? 'Task 1.1' : 'Task 1.2')
    return [
      `${weakTask} uchun kuniga 1 ta mini-draft yozing (kirish + 2 ta asosiy fikr).`,
      'Yozuvdan keyin check-list: grammar, linking, lexical variation bo‘yicha 3 bosqichli tekshiruv qiling.',
      'Haftasiga 2 marta timed writing bilan progressni solishtiring.',
    ]
  }

  if (key === 'speaking' && Number.isFinite(skill.cefrScore75)) {
    return [
      'Har kuni 12 daqiqa speaking drill: 4 daqiqa fluency, 4 daqiqa lexical variation, 4 daqiqa pronunciation.',
      'Har javobda kamida 2 ta advanced connector ishlatish odatini kiriting.',
      'Haftasiga 3 marta 75-ball rubric asosida self-assessment qiling.',
    ]
  }

  return []
}

function buildInstantInsightReply(question: string, snapshot: StudentInsightSnapshot) {
  const normalized = normalizeQuestion(question)
  const attendanceLabel = snapshot.lastAttendance === 'late'
    ? 'kechikkan'
    : snapshot.lastAttendance === 'absent'
      ? "darsda yo'q"
      : snapshot.lastAttendance === 'present'
        ? 'hozir bo‘lgan'
        : "ma'lumot yo'q"

  const trendText = snapshot.scoreTrend === 'up'
    ? 'ball o‘sish trendida'
    : snapshot.scoreTrend === 'down'
      ? 'ball pasayish trendida'
      : 'ball barqaror'

  const mainSummary = [
    `📌 <b>Holat:</b> ${snapshot.studentName} uchun davomat ${snapshot.attendanceRate}%, oxirgi umumiy ball ${snapshot.latestScore.toFixed(1)}%, haftalik reyting ${snapshot.weeklyRank || 0}-o‘rin.`,
    `📊 So‘nggi holat: ${attendanceLabel}; 14 kunda kechikish ${snapshot.lateCount14d} ta, qatnashmaslik ${snapshot.absentCount14d} ta; ${trendText}.`
  ]

  const sortedSkills = [...snapshot.skills].sort((a, b) => a.percent - b.percent)
  const weakest = sortedSkills[0]
  const mentionedSkillKey = inferQuestionSkill(question, snapshot.skills)
  const mentionedSkill = snapshot.skills.find((item) => item.key === mentionedSkillKey)

  if (mentionedSkill) {
    if (['listening', 'reading', 'writing', 'speaking'].includes(mentionedSkill.key)) {
      const skillPercent = Number(mentionedSkill.percent || 0)
      const status = skillPercent < 50 ? 'kritik darajada past' : skillPercent < 70 ? 'o‘rtacha, tez kuchaytirish kerak' : 'barqaror'
      const weakestPart = String(mentionedSkill.weakestPart || '').trim()
      const concreteRecommendation: Record<string, string[]> = {
        listening: [
          'Har kuni 20 daqiqa audio eshiting va 8 ta kalit so‘z yozib chiqing.',
          'Haftasiga 3 marta 10 savollik time-limited listening test ishlang.',
          'Xato savollarni alohida daftarga yozib, sababini 1 jumlada belgilang.',
        ],
        reading: [
          'Har kuni 1 ta qisqa matnni 12 daqiqada o‘qib, 5 savolga javob yozing.',
          'Skimming/scanning uchun 10 daqiqalik alohida mashq qiling.',
          'Har matndan 6 ta yangi so‘zni gapda qo‘llang.',
        ],
        writing: [
          'Task Response/Cohesion/Grammar bo‘yicha kuniga 1 ta mini-paragraf yozing (80-100 so‘z).',
          'Har yozuvdan keyin kamida 5 ta xatoni qayta tuzatib yozing.',
          'Haftasiga 2 marta to‘liq writing task time-limit bilan bajaring.',
        ],
        speaking: [
          'Har kuni 10 daqiqa ovoz yozib speaking practice qiling.',
          'Fluency uchun 5 ta savolga 1 daqiqadan to‘xtamasdan javob bering.',
          'Pronunciation uchun minimal pairs drill va synonym ishlatish mashqi qiling.',
        ],
      }
      const partSpecificRecommendations = buildPartSpecificRecommendations(mentionedSkill)
      const recommendationBlock = partSpecificRecommendations.length
        ? partSpecificRecommendations
        : (concreteRecommendation[mentionedSkill.key] || concreteRecommendation.reading)
      const cefrSpeakingMeta = mentionedSkill.key === 'speaking' && Number.isFinite(mentionedSkill.cefrScore75)
        ? `CEFR score: ${Number(mentionedSkill.cefrScore75)}/75${mentionedSkill.levelDetected ? ` (${mentionedSkill.levelDetected})` : ''}.`
        : ''

      return [
        ...mainSummary,
        '',
        `🎯 <b>${mentionedSkill.label} diagnostika:</b> ${mentionedSkill.score}/${mentionedSkill.maxScore} (${skillPercent.toFixed(1)}%).`,
        `🧠 Holat: ${status}.`,
        ...(weakestPart ? [`📍 Eng zaif qism: ${weakestPart}.`] : []),
        ...(cefrSpeakingMeta ? [`🧭 ${cefrSpeakingMeta}`] : []),
        ...(mentionedSkill.comment ? [`👩‍🏫 O‘qituvchi izohi: <i>${mentionedSkill.comment}</i>`] : []),
        '',
        '<b>✅ Aniq tavsiya (7 kun):</b>',
        ...(recommendationBlock.map((item) => `• ${item}`)),
      ].join('\n')
    }

    if (mentionedSkill.key === 'vocabulary') {
      const unknownWords = getUnknownVocabularyWords(mentionedSkill)
      const sampleWords = unknownWords.slice(0, 8)
      const sentenceExamples = sampleWords.map((word, index) => `• ${escapeHtml(word)} → ${escapeHtml(buildExampleSentenceForWord(word, index))}`)
      const vocabComment = mentionedSkill.comment || 'Lug‘atni gap ichida qo‘llashga ko‘proq mashq kerak.'

      return [
        ...mainSummary,
        '',
        `🎯 <b>Vocabulary:</b> ${mentionedSkill.score}/${mentionedSkill.maxScore} (${mentionedSkill.percent.toFixed(1)}%).`,
        `🧠 Tahlil: ${vocabComment}`,
        `✅ Hozir asosiy kamchilik: bilmagan so‘zlarni gapda ishlatish barqaror emas.`,
        ...(sampleWords.length > 0
          ? [
              '',
              '<b>📝 Bilmagan so‘zlarga bittadan gap:</b>',
              ...sentenceExamples,
            ]
          : []),
        '',
        '📌 7 kunlik mini-reja: har kuni 8-10 ta so‘zdan kamida 5 tasini gapda ishlating, keyingi darsda og‘zaki aytib bering.',
      ].join('\n')
    }

    if (mentionedSkill.key === 'grammar') {
      const sentenceStructure = Number(mentionedSkill.sentenceStructure ?? 0)
      const topicMastery = Number(mentionedSkill.topicMastery ?? mentionedSkill.toBeTenses ?? 0)
      const spelling = Number(mentionedSkill.spelling ?? 0)
      const weakAreas: string[] = []

      if (sentenceStructure > 0 && sentenceStructure < 24) weakAreas.push('sentence structure')
      if (topicMastery > 0 && topicMastery < 24) weakAreas.push('topic mastery')
      if (spelling > 0 && spelling < 12) weakAreas.push('spelling')

      return [
        ...mainSummary,
        '',
        `🎯 <b>Grammar:</b> ${mentionedSkill.score}/${mentionedSkill.maxScore} (${mentionedSkill.percent.toFixed(1)}%).`,
        `🧠 Kamchilik: ${weakAreas.length ? weakAreas.join(', ') : 'grammar asoslarini mustahkamlash kerak'}.`,
        ...(mentionedSkill.comment ? [`👩‍🏫 O‘qituvchi izohi: <i>${mentionedSkill.comment}</i>`] : []),
        '',
        '<b>✅ Tuzatish rejasi:</b>',
        '• Har kuni 10 ta gap: Subject + Verb + Object tartibida yozish.',
        '• Har kuni 15 ta "to be / tense" mashqi (am/is/are + was/were).',
        '• Har darsda 5 ta xato yozilgan gapni to‘g‘rilab qayta yozish.',
      ].join('\n')
    }

    if (mentionedSkill.key === 'attendance') {
      const riskText = snapshot.absentCount14d >= 2 || snapshot.lateCount14d >= 2
        ? 'davomat intizomi pasaygan'
        : 'davomat nazorat ostida, lekin barqarorlik kerak'

      return [
        ...mainSummary,
        '',
        `🎯 <b>Attendance:</b> ${mentionedSkill.score}/${mentionedSkill.maxScore} (${mentionedSkill.percent.toFixed(1)}%).`,
        `🧠 Tahlil: ${riskText}. Oxirgi 14 kunda kechikish ${snapshot.lateCount14d} ta, qatnashmaslik ${snapshot.absentCount14d} ta.`,
        '✅ Fikr: darsdan 20 daqiqa oldin yo‘lga chiqish va kechqurun ertangi dars uchun checklist tayyorlash kerak.',
      ].join('\n')
    }

    if (mentionedSkill.key === 'translation' || mentionedSkill.key === 'reading') {
      return [
        ...mainSummary,
        '',
        `🎯 <b>${mentionedSkill.label}:</b> ${mentionedSkill.score}/${mentionedSkill.maxScore} (${mentionedSkill.percent.toFixed(1)}%).`,
        `🧠 Tahlil: matnni tushunish va tarjimada aniqlikni oshirish kerak.`,
        ...(mentionedSkill.comment ? [`👩‍🏫 O‘qituvchi izohi: <i>${mentionedSkill.comment}</i>`] : []),
        '',
        '<b>✅ Amaliy feedback:</b>',
        '• Har kuni 5 ta qisqa gapni EN↔UZ tarjima qiling.',
        '• Matndan 6 ta kalit so‘zni ajratib, har biri bilan 1 tadan gap yozing.',
        '• Tarjimani ovoz chiqarib o‘qib, grammar xatolarini tekshiring.',
      ].join('\n')
    }

    const links = buildYouTubeLinksForSkill(mentionedSkill.key)
    const weeklyPlan = buildWeeklyPlanForSkill(mentionedSkill.key)
    const homework = buildHomeworkSuggestions(mentionedSkill.key)
    const statusText = mentionedSkill.percent < 50
      ? 'past'
      : mentionedSkill.percent < 70
        ? 'o‘rtacha'
        : 'yaxshi'

    const reasons: string[] = []
    if (snapshot.lastAttendance === 'absent' || snapshot.lastAttendance === 'late') {
      reasons.push('davomat ritmi beqaror')
    }
    if (mentionedSkill.comment) {
      reasons.push(`o‘qituvchi izohi: ${mentionedSkill.comment}`)
    }
    if (snapshot.scoreTrend === 'down') {
      reasons.push('umumiy o‘zlashtirish pasayish trendida')
    }
    if (snapshot.lateCount14d >= 2 || snapshot.absentCount14d >= 2) {
      reasons.push('oxirgi 14 kunda dars uzilishi ko‘p')
    }

    return [
      ...mainSummary,
      '',
      `🎯 <b>${mentionedSkill.label}</b>: ${mentionedSkill.score}/${mentionedSkill.maxScore} (${mentionedSkill.percent.toFixed(1)}%) — ${statusText}.`,
      `🧠 Ehtimoliy sabab: ${reasons.length ? reasons.join('; ') : 'muntazam mashq yetishmasligi bo‘lishi mumkin.'}`,
      ...(mentionedSkill.comment ? ['', `👩‍🏫 O‘qituvchi izohi: <i>${mentionedSkill.comment}</i>`] : []),
      '',
      '<b>📅 7 kunlik action-plan:</b>',
      ...weeklyPlan.map((item) => `• ${item}`),
      '',
      '<b>📝 Uyga vazifa tavsiyasi:</b>',
      ...homework.map((item) => `• ${item}`),
      '',
      '📺 Tavsiya etilgan YouTube mashg‘ulotlar:',
      `1) ${links[0]}`,
      `2) ${links[1]}`,
    ].join('\n')
  }

  if (/kech|nega|sabab/.test(normalized)) {
    const reasons: string[] = []
    if (snapshot.lastLateNote && snapshot.lastLateNote !== "yo'q") {
      reasons.push(`oxirgi izoh: “${snapshot.lastLateNote}”`)
    }
    if (snapshot.absentCount14d >= 2 || snapshot.lateCount14d >= 2) {
      reasons.push('davomat intizomi pasaygan')
    }
    if (snapshot.scoreTrend === 'down') {
      reasons.push('o‘qish yuklamasi yoki tayyorgarlik ritmi sustlashgan bo‘lishi mumkin')
    }
    if (snapshot.lastPaymentStatus === 'overdue' || snapshot.lastPaymentStatus === 'pending') {
      reasons.push('to‘lov holati ham darsga qatnashish ritmiga ta’sir qilishi mumkin')
    }

    return [
      ...mainSummary,
      '',
      `🧠 <b>Ehtimoliy sabablar:</b> ${reasons.length ? reasons.join('; ') : 'aniq sabab yozilmagan, qo‘shimcha izoh kerak.'}`,
      '✅ Tavsiya: 1) kelish vaqti rejasi, 2) har darsdan keyin 10-15 daqiqa takror, 3) 1 haftalik monitoring.'
    ].join('\n')
  }

  if (/davomat/.test(normalized)) {
    return [
      ...mainSummary,
      '',
      `🗓️ Oxirgi holat: ${attendanceLabel}.`,
      `✅ Tavsiya: ertangi darsga kechikmaslik uchun chiqish vaqtini 20 daqiqa oldinga suring.`
    ].join('\n')
  }

  if (/ball|baho|reyting|past/.test(normalized)) {
    const weakSkillsText = sortedSkills.slice(0, 2).map((item) => `${item.label}: ${item.percent.toFixed(1)}%`).join(', ')
    const weakComments = sortedSkills
      .slice(0, 2)
      .filter((item) => item.comment)
      .map((item) => `${item.label}: ${(item.comment || '').trim()}`)
      .filter(Boolean)
    const weakestKey = sortedSkills[0]?.key || 'grammar'
    const weeklyPlan = buildWeeklyPlanForSkill(weakestKey)
    const homework = buildHomeworkSuggestions(weakestKey)
    return [
      ...mainSummary,
      '',
      `🎯 Tahlil: Hozir ${trendText}.`,
      `${weakSkillsText ? `⚠️ Past ko‘nikmalar: ${weakSkillsText}.` : ''}`,
      ...(weakComments.length ? [`👩‍🏫 O‘qituvchi izohlari: ${weakComments.join(' | ')}`] : []),
      '✅ Tavsiya: eng past 2 ko‘nikmaga har kuni 25-30 daqiqa mashq qiling va haftalik mini-test qiling.',
      '',
      '<b>📅 Boshlash uchun 1 haftalik reja:</b>',
      ...weeklyPlan.slice(0, 4).map((item) => `• ${item}`),
      '',
      '<b>📝 Uyga vazifa:</b>',
      ...homework.map((item) => `• ${item}`),
    ].join('\n')
  }

  if (/qanday|yechim|tavsiya|reja|nima qil|yordam/.test(normalized)) {
    const weakestKey = sortedSkills[0]?.key || 'grammar'
    const weakestLabel = SKILL_LABEL[weakestKey] || weakestKey
    const weeklyPlan = buildWeeklyPlanForSkill(weakestKey)
    const homework = buildHomeworkSuggestions(weakestKey)
    const links = buildYouTubeLinksForSkill(weakestKey)

    return [
      ...mainSummary,
      '',
      `🧭 <b>Asosiy yo‘nalish:</b> hozir ${weakestLabel} ustida ishlash eng katta natija beradi.`,
      ...(sortedSkills[0]?.comment ? [`👩‍🏫 O‘qituvchi izohi: <i>${sortedSkills[0].comment}</i>`, ''] : ['']),
      '',
      '<b>📅 7 kunlik action-plan:</b>',
      ...weeklyPlan.map((item) => `• ${item}`),
      '',
      '<b>📝 Uyga vazifa:</b>',
      ...homework.map((item) => `• ${item}`),
      '',
      '<b>📺 YouTube resurslar:</b>',
      `1) ${links[0]}`,
      `2) ${links[1]}`,
    ].join('\n')
  }

  if (/youtube|link|manba|resurs|qo'llanma|qollanma/.test(normalized)) {
    const targetSkill = weakest?.key || 'grammar'
    const links = buildYouTubeLinksForSkill(targetSkill)
    return [
      ...mainSummary,
      '',
      `📺 Hozir eng foydali yo‘nalish: <b>${SKILL_LABEL[targetSkill] || targetSkill}</b>.`,
      `1) ${links[0]}`,
      `2) ${links[1]}`,
      '✅ Shu videolar asosida 1 hafta davomida kuniga 30 daqiqa ishlang, keyin qayta baholaymiz.'
    ].join('\n')
  }

  if (/to'lov|tolov|qarz|payment/.test(normalized)) {
    return [
      ...mainSummary,
      '',
      `💳 To‘lov holati: ${snapshot.lastPaymentStatus}.`,
      '✅ Tavsiya: to‘lovni vaqtida yopish dars ritmini ushlashga yordam beradi.'
    ].join('\n')
  }

  const weakestKey = sortedSkills[0]?.key || 'grammar'
  const weakestLabel = SKILL_LABEL[weakestKey] || weakestKey
  const weeklyPlan = buildWeeklyPlanForSkill(weakestKey)
  const links = buildYouTubeLinksForSkill(weakestKey)

  return [
    ...mainSummary,
    '',
    `🧠 Savolingiz bo‘yicha eng foydali yo‘nalish: <b>${weakestLabel}</b>.`,
    '<b>📅 Tezkor reja:</b>',
    ...weeklyPlan.slice(0, 3).map((item) => `• ${item}`),
    '',
    '<b>📺 Resurslar:</b>',
    `1) ${links[0]}`,
    `2) ${links[1]}`,
  ].join('\n')
}

async function askGeminiWithFallback(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
  if (!apiKey) return ''

  const configuredModels = (process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-2.0-flash-lite,gemini-1.5-flash-latest,gemini-1.5-pro-latest,gemini-1.5-flash')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const models = configuredModels.length
    ? configuredModels
    : ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash']

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 15000)
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000

  for (const model of models) {
    const urls = [
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
    ]

    for (const url of urls) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), safeTimeout)

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(url.includes('?key=') ? {} : { 'x-goog-api-key': apiKey }),
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 520,
            }
          }),
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) {
          const raw = await response.text()
          console.error(`Gemini API error (${model}) [${url.includes('/v1beta/') ? 'v1beta' : 'v1'}]:`, raw)
          continue
        }

        const data = await response.json()
        const text = (data?.candidates || [])
          .flatMap((candidate: any) => candidate?.content?.parts || [])
          .map((part: any) => part?.text)
          .filter(Boolean)
          .join('\n')
          ?.trim()

        if (text) {
          return text
        }

        if (data?.promptFeedback?.blockReason) {
          console.error(`Gemini blocked prompt (${model}):`, data.promptFeedback)
        }
      } catch (error) {
        console.error(`Gemini request failed (${model}):`, error)
      }
    }
  }

  return ''
}

function buildAiConversationFallback(input: { question: string; snapshot: StudentInsightSnapshot }) {
  const q = String(input.question || '').trim()
  if (!q) {
    return `Marhamat, ${input.snapshot.parentName}. Savolingizni yozing, men erkin formatda javob beraman.`
  }

  const trendText = input.snapshot.scoreTrend === 'up'
    ? 'o‘sish trendida'
    : input.snapshot.scoreTrend === 'down'
      ? 'pasayish trendida'
      : 'barqaror'

  return [
    `Sizning savolingiz: “${q}”`,
    '',
    `Qisqa holat: ${input.snapshot.studentName} uchun davomat ${input.snapshot.attendanceRate}%, oxirgi umumiy ball ${input.snapshot.latestScore.toFixed(1)}%, ball dinamikasi ${trendText}.`,
    '',
    'Amaliy tavsiya:',
    '1) Savolingizga mos bitta aniq maqsad qo‘yamiz (7 kunlik).',
    '2) Har kuni 25-30 daqiqa nazoratli mashq + qisqa hisobot yuritamiz.',
    '3) 1 haftadan keyin natijani qayta o‘lchab, keyingi rejani yangilaymiz.',
    '',
    'Xohlasangiz, savolingizni biroz batafsilroq yozing — men shu mavzu bo‘yicha aniq, bosqichma-bosqich plan beraman.'
  ].join('\n')
}

async function buildParentAssistantReply(input: {
  question: string
  snapshot: StudentInsightSnapshot
}) {
  const fastReply = buildInstantInsightReply(input.question, input.snapshot)
  const inferredSkillKey = inferQuestionSkill(input.question, input.snapshot.skills)
  const inferredSkillLabel = inferredSkillKey ? (SKILL_LABEL[inferredSkillKey] || inferredSkillKey) : 'Auto'
  const beginnerSkillSet = ['vocabulary', 'grammar', 'translation', 'attendance']
  const isBeginnerSnapshot = beginnerSkillSet.every((key) => input.snapshot.skills.some((item) => item.key === key))
  const vocabularySkill = input.snapshot.skills.find((item) => item.key === 'vocabulary')
  const unknownVocabularyWords = getUnknownVocabularyWords(vocabularySkill)

  const skillsTable = input.snapshot.skills.length
    ? input.snapshot.skills
        .map((item) => `${item.label}: ${item.score}/${item.maxScore} (${item.percent.toFixed(1)}%)${item.comment ? ` | Izoh: ${item.comment}` : ''}${item.key === 'vocabulary' ? ` | Bilmagan so'zlar: ${getUnknownVocabularyWords(item).join(', ') || 'yo\'q'}` : ''}`)
        .join('; ')
    : "Ko'nikma kesimidagi ma'lumot yo'q"

  const prompt = [
    "Siz Kevin's Academy uchun ota-onalar yordamchi AI'sisiz.",
    'Faqat o\'zbek tilida, sodda va aniq javob bering. Javob tez va amaliy bo\'lsin.',
    'Foydalanuvchi istalgan mavzuda savol berishi mumkin; savolni rad qilmang va imkon qadar foydali javob bering.',
    'Agar ma\'lumot yetarli bo\'lmasa, taxmin qilmang va nimasi yetishmayotganini ayting.',
    'Maktab ichki ma\'lumotlari asosida bolaning holatini izohlang va amaliy tavsiya bering.',
    'Ko‘nikmalar bo‘yicha o‘qituvchi izohlari mavjud bo‘lsa, aynan shu izohlardan kelib chiqib yechim, uy vazifa va resurslar bering.',
    '',
    `<OTA_ONA>${input.snapshot.parentName}</OTA_ONA>`,
    `<FARZAND>${input.snapshot.studentName}</FARZAND>`,
    `<GURUH>${input.snapshot.group}</GURUH>`,
    `<DAVOMAT_FOIZ>${input.snapshot.attendanceRate}%</DAVOMAT_FOIZ>`,
    `<OXIRGI_UMUMIY_BALL>${input.snapshot.latestScore}%</OXIRGI_UMUMIY_BALL>`,
    `<HAFTALIK_REYTING>${input.snapshot.weeklyRank}</HAFTALIK_REYTING>`,
    `<MOCK_REYTING>${input.snapshot.mockRank}</MOCK_REYTING>`,
    `<OXIRGI_TULOV_HOLATI>${input.snapshot.lastPaymentStatus}</OXIRGI_TULOV_HOLATI>`,
    `<OXIRGI_DAVOMAT_HOLATI>${input.snapshot.lastAttendance}</OXIRGI_DAVOMAT_HOLATI>`,
    `<14KUN_KECHIKISH>${input.snapshot.lateCount14d}</14KUN_KECHIKISH>`,
    `<14KUN_QATNASHMASLIK>${input.snapshot.absentCount14d}</14KUN_QATNASHMASLIK>`,
    `<OXIRGI_KECHIKISH_IZOHI>${input.snapshot.lastLateNote}</OXIRGI_KECHIKISH_IZOHI>`,
    `<BALL_TREND>${input.snapshot.scoreTrend}</BALL_TREND>`,
    `<LEVEL_TRACK>${isBeginnerSnapshot ? 'beginner' : 'mixed/advanced'}</LEVEL_TRACK>`,
    `<TARGET_SECTION>${inferredSkillLabel}</TARGET_SECTION>`,
    `<VOCAB_UNKNOWN_WORDS>${unknownVocabularyWords.join(', ') || 'yo\'q'}</VOCAB_UNKNOWN_WORDS>`,
    `<SKILL_TABLE>${skillsTable}</SKILL_TABLE>`,
    '',
    `Savol: ${input.question}`,
    '',
    'Javob formati: 1) Qisqa holat 2) Sabab tahlili 3) 2-3 ta amaliy tavsiya.',
    'Agar savolda fan/ko‘nikma so‘ralsa, aynan o‘sha ko‘nikma bo‘yicha javob bering.',
    'SAVOLNI O‘ZINGIZ TAHLIL QILING: qaysi bo‘lim so‘ralganini aniqlang va aynan shu bo‘limga mos javob yozing.',
    'Agar TARGET_SECTION = Grammar bo‘lsa: kamchilik turini ayting va 3 ta tuzatish mashqini bering.',
    'Agar TARGET_SECTION = Vocabulary bo‘lsa: VOCAB_UNKNOWN_WORDS dagi har bir so‘z uchun bittadan sodda inglizcha gap yozing (maksimal 8 ta).',
    'Agar TARGET_SECTION = Attendance bo‘lsa: davomat bo‘yicha aniq fikr bildiring va 7 kunlik intizom reja bering.',
    'Agar TARGET_SECTION = Translation yoki Reading bo‘lsa: o‘qish/tarjima xatolari uchun 3 ta amaliy drill bering.',
    'Agar LEVEL_TRACK = beginner bo‘lsa, javobni beginner o‘quvchiga mos, sodda va juda aniq qiling.',
    'Agar foydali manba yoki mashq so‘ralsa, kamida 2 ta YouTube link bering.',
    'Javobda umumiy gaplardan qoching, section izohlarini konkret amalga aylantiring.'
  ].join('\n')

  const aiText = await askGeminiWithFallback(prompt)
  if (aiText) {
    return aiText
  }

  const fallbackReply = buildAiConversationFallback(input)
  return fallbackReply || fastReply
}

function buildBotModeReply(input: { question: string; snapshot: StudentInsightSnapshot }) {
  if (!isBotAllowedQuestion(input.question)) {
    return [
      '📘 <b>KEVIN BOT rejimi</b>',
      '',
      'Men faqat quyidagi yo\'nalishlarda javob bera olaman:',
      '• Grammar',
      '• Vocabulary',
      '• Attendance (Qatnashuv)',
      '• Translation / Reading',
      '',
      'Namuna savollar:',
      '• Grammar topic bo‘yicha kamchilik nima?',
      '• Vocabulary muammoni hal qilish',
      '• Qatnashuv bo‘yicha fikr ber',
      '• O‘qish / Tarjima uchun feedback ber'
    ].join('\n')
  }

  const inferredSkillKey = inferQuestionSkill(input.question, input.snapshot.skills)
  if (!inferredSkillKey) {
    const weakest = getWeakestSkill(input.snapshot)
    if (weakest) {
      return buildInstantInsightReply(`${weakest.label} bo‘yicha diagnostika va aniq tavsiya ber`, input.snapshot)
    }
  }

  return buildInstantInsightReply(input.question, input.snapshot)
}

function parseStartLinkCode(text: string) {
  const normalized = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  if (!normalized.toLowerCase().startsWith('/start')) return ''

  const withoutCommand = normalized
    .replace(/^\/start(?:@[A-Za-z0-9_]+)?/i, '')
    .trim()

  if (withoutCommand) return withoutCommand

  const parts = normalized.split(/\s+/)
  return parts[1] || ''
}

function parsePhoneLinkCode(text: string) {
  const normalized = String(text || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  if (!normalized) return ''
  if (normalized.startsWith('/')) return ''

  if (!/^[+\d\s()\-]{7,24}$/.test(normalized)) {
    return ''
  }

  return normalized
}

async function buildSnapshotByChatId(chatId: string): Promise<StudentInsightSnapshot | null> {
  const linkedParent = await resolveParentByChatId(chatId)
  if (!linkedParent) return null

  const linkedStudentId = linkedParent?.unpacked?.studentId ? Number(linkedParent.unpacked.studentId) : null
  const student = linkedStudentId
    ? await prisma.student.findUnique({ where: { id: linkedStudentId }, select: { id: true, fullName: true, group: true, adminId: true } })
    : null

  const groupInfo = student?.group
    ? await prisma.group.findFirst({ where: { name: student.group }, select: { level: true } })
    : null

  const [scores, attendance, payments] = linkedStudentId
    ? await Promise.all([
        prisma.score.findMany({ where: { studentId: linkedStudentId }, orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.attendance.findMany({ where: { studentId: linkedStudentId }, orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.payment.findMany({ where: { studentId: linkedStudentId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      ])
    : [[], [], []]

  const latestScore = scores[0] ? Number(scores[0].overallPercent ?? scores[0].value ?? 0) : 0
  const attendedCount = attendance.filter((row) => row.status === 'present' || row.status === 'late').length
  const attendanceRate = attendance.length ? Math.round((attendedCount / attendance.length) * 100) : 0
  const lastAttendance = attendance[0]?.status || "yo'q"
  const lastPaymentStatus = payments[0]?.status || "yo'q"
  const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)
  const recentAttendance = attendance.filter((row) => {
    const d = row?.date ? new Date(row.date).getTime() : 0
    return d >= fourteenDaysAgo
  })
  const lateCount14d = recentAttendance.filter((row) => row.status === 'late').length
  const absentCount14d = recentAttendance.filter((row) => row.status === 'absent').length
  const lastLateNote = attendance.find((row) => row.status === 'late' && row.note)?.note || "yo'q"
  const scoreTrend = scoreTrendFromRows(scores)
  const skills = extractSkillInsights(scores)

  const groupStudents = student?.group
    ? await prisma.student.findMany({ where: { group: student.group }, select: { id: true, fullName: true } })
    : []
  const groupStudentIds = groupStudents.map((row) => row.id)

  const [weeklyRows, mockRows] = groupStudentIds.length
    ? await Promise.all([
        prisma.score.findMany({ where: { studentId: { in: groupStudentIds }, scoreType: 'weekly' }, orderBy: { createdAt: 'desc' } }),
        prisma.score.findMany({ where: { studentId: { in: groupStudentIds }, scoreType: 'mock' }, orderBy: { createdAt: 'desc' } }),
      ])
    : [[], []]

  const getRank = (rows: typeof weeklyRows, studentId?: number | null) => {
    if (!studentId || !rows.length || !groupStudents.length) return 0

    const latestByStudent = new Map<number, number>()
    for (const row of rows) {
      if (!row.studentId || latestByStudent.has(row.studentId)) continue
      latestByStudent.set(row.studentId, Number(row.overallPercent ?? row.value ?? 0))
    }

    const ranked = groupStudents
      .map((groupStudent) => ({
        id: groupStudent.id,
        score: latestByStudent.get(groupStudent.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score)

    let currentRank = 0
    let previousScore: number | null = null
    for (let i = 0; i < ranked.length; i += 1) {
      const row = ranked[i]
      if (previousScore === null || row.score < previousScore) {
        currentRank = i + 1
        previousScore = row.score
      }
      if (row.id === studentId) return currentRank
    }

    return 0
  }

  const weeklyRank = getRank(weeklyRows, student?.id)
  const mockRank = getRank(mockRows, student?.id)

  return {
    parentName: linkedParent?.unpacked?.fullName || linkedParent?.raw?.fullName || 'Ota-ona',
    studentName: student?.fullName || 'Noma\'lum',
    group: student?.group || 'Noma\'lum',
    level: normalizeLevel(groupInfo?.level || ''),
    attendanceRate,
    latestScore,
    weeklyRank,
    mockRank,
    lastPaymentStatus,
    lastAttendance,
    lastLateNote,
    lateCount14d,
    absentCount14d,
    scoreTrend,
    skills,
  }
}

function getSectionPresetQuestion(section: string) {
  const normalized = String(section || '').trim().toLowerCase()
  if (normalized === 'listening') return 'Listening bo‘yicha diagnostika qilib aniq mashq reja ber'
  if (normalized === 'reading') return 'Reading bo‘yicha diagnostika qilib aniq mashq reja ber'
  if (normalized === 'writing') return 'Writing bo‘yicha diagnostika qilib aniq mashq reja ber'
  if (normalized === 'speaking') return 'Speaking bo‘yicha diagnostika qilib aniq mashq reja ber'
  if (normalized === 'grammar') return 'Grammar topic bo‘yicha kamchilikni tahlil qilib tuzatish reja ber'
  if (normalized === 'vocabulary') return 'Vocabulary muammoni hal qilish va bilmagan so‘zlarga gap tuzib ber'
  if (normalized === 'attendance') return 'Qatnashuv bo‘yicha fikr va amaliy tavsiya ber'
  if (normalized === 'translation') return 'O‘qish va tarjima bo‘yicha feedback ber'
  return 'Beginner bo‘limi bo‘yicha feedback ber'
}

export async function GET() {
  const tokenConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN)
  const parentPortalConfigured = Boolean(process.env.PARENT_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL)

  return NextResponse.json({
    ok: true,
    service: 'telegram-webhook',
    tokenConfigured,
    parentPortalConfigured,
    now: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('Telegram webhook: TELEGRAM_BOT_TOKEN is missing in environment')
      return NextResponse.json({ ok: true, warning: 'missing_telegram_bot_token' })
    }

    const body = await request.json()
    const membershipUpdate = body?.my_chat_member || body?.chat_member
    const memberChatId = membershipUpdate?.chat?.id ? String(membershipUpdate.chat.id) : ''
    const oldStatus = String(membershipUpdate?.old_chat_member?.status || '').toLowerCase()
    const newStatus = String(membershipUpdate?.new_chat_member?.status || '').toLowerCase()

    if (memberChatId && newStatus) {
      const becameDisconnected = ['left', 'kicked', 'restricted'].includes(newStatus)
      const becameConnected = ['member', 'administrator', 'creator'].includes(newStatus)

      if (becameDisconnected || becameConnected) {
        await updateParentBotStatusByChatId({
          chatId: memberChatId,
          status: becameDisconnected ? 'DISCONNECTED' : 'CONNECTED',
          errorDescription: becameDisconnected
            ? `Telegram membership change: ${oldStatus || 'unknown'} -> ${newStatus}`
            : undefined,
        })

        return NextResponse.json({
          ok: true,
          action: 'membership_status_updated',
          status: newStatus,
        })
      }
    }

    const callbackQuery = body?.callback_query

    if (callbackQuery?.id && callbackQuery?.message?.chat?.id) {
      const chatId = String(callbackQuery.message.chat.id)
      const data = String(callbackQuery.data || '')

      if (data === 'copy_card_details') {
        const cardNumber = process.env.PAYMENT_CARD_NUMBER || DEFAULT_CARD_NUMBER
        await answerTelegramCallbackQuery({
          callbackQueryId: String(callbackQuery.id),
          text: `Karta: ${cardNumber}`,
        })

        await sendTelegramMessage({
          chatId,
          text: `📋 <b>Karta rekvizitlari</b>\n\n<code>${cardNumber}</code>\n\nNusxalash uchun karta raqamini bosib ushlab turing.`,
        })

        return NextResponse.json({ ok: true, action: 'copy_card_details' })
      }

      if (data.startsWith('contact_phone:')) {
        const phoneDigits = String(data.slice('contact_phone:'.length) || '').replace(/\D/g, '')

        await answerTelegramCallbackQuery({
          callbackQueryId: String(callbackQuery.id),
          text: phoneDigits ? 'Kontakt yuborildi' : 'Telefon raqami topilmadi',
        })

        if (phoneDigits) {
          await sendTelegramContactCard({
            chatId,
            phoneNumber: `+${phoneDigits}`,
            firstName: 'Aloqa',
            lastName: "Kevin's Academy",
          })

          await sendTelegramMessage({
            chatId,
            text: `📞 <b>Aloqa raqami</b>\n\n<code>+${phoneDigits}</code>\n\nKontakt kartadan qo‘ng‘iroq qiling yoki saqlab qo‘ying.`,
          })
        }

        return NextResponse.json({ ok: true, action: 'contact_phone' })
      }

      if (data === 'kevin_show_sections') {
        const snapshot = await buildSnapshotByChatId(chatId)
        if (!snapshot) {
          const sent = await sendTelegramMessage({
            chatId,
            text: "ℹ️ Avval botni bog'lang: <code>/start +998901234567</code>",
            modeButtons: true,
          })
          if (!sent.ok) {
            console.error('Telegram webhook: failed sending section no-link message', sent)
          }
          return NextResponse.json({ ok: true, action: 'kevin_show_sections_no_link' })
        }

        const track = getSnapshotTrack(snapshot)
        const pickerButtons = getSectionButtonsForTrack(track)

        await answerTelegramCallbackQuery({
          callbackQueryId: String(callbackQuery.id),
          text: track === 'intermediate' ? 'Intermediate bo‘limlardan birini tanlang' : 'Beginner bo‘limlardan birini tanlang',
        })

        const sent = await sendTelegramMessage({
          chatId,
          text: [
            '📘 <b>Savol uchun KEVIN BOT</b>',
            '',
            track === 'intermediate'
              ? 'Intermediate/CEFR bo‘limini tanlang. Men eng past ko‘nikmaga tayangan holda aniq diagnostika va mashq reja beraman.'
              : 'Beginner bo‘limini tanlang. Men shu bo‘lim bo‘yicha farzandingizning joriy ballariga tayangan holda javob beraman.'
          ].join('\n'),
          modeButtons: false,
          extraButtons: pickerButtons
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending section picker message', sent)
        }

        return NextResponse.json({ ok: true, action: 'kevin_show_sections' })
      }

      if (data.startsWith('kevin_section_')) {
        const section = String(data.replace('kevin_section_', '') || '').trim().toLowerCase()
        await answerTelegramCallbackQuery({
          callbackQueryId: String(callbackQuery.id),
          text: 'Bo‘lim tahlili tayyorlanmoqda',
        })

        const snapshot = await buildSnapshotByChatId(chatId)
        if (!snapshot) {
          const sent = await sendTelegramMessage({
            chatId,
            text: "ℹ️ Avval botni bog'lang: <code>/start +998901234567</code>",
            modeButtons: true,
          })
          if (!sent.ok) {
            console.error('Telegram webhook: failed sending section no-link message', sent)
          }
          return NextResponse.json({ ok: true, action: 'kevin_section_no_link' })
        }

        const botText = buildBotModeReply({
          question: getSectionPresetQuestion(section),
          snapshot,
        })

        const sent = await sendTelegramMessage({
          chatId,
          text: `📘 <b>KEVIN BOT</b>\n\n${botText}`,
          modeButtons: true,
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending section feedback', sent)
        }

        return NextResponse.json({ ok: true, action: `kevin_section_${section}` })
      }

      await answerTelegramCallbackQuery({ callbackQueryId: String(callbackQuery.id) })
      return NextResponse.json({ ok: true })
    }

    const message = body?.message || body?.edited_message
    const chatId = message?.chat?.id ? String(message.chat.id) : ''
    const fromUser = message?.from || null
    const text = typeof message?.text === 'string'
      ? message.text
      : (typeof message?.caption === 'string' ? message.caption : '')
    const contactPhone = typeof message?.contact?.phone_number === 'string' ? String(message.contact.phone_number) : ''
    const startMessage = isStartCommand(text)

    if (!chatId || (!text && !contactPhone)) {
      return NextResponse.json({ ok: true })
    }

    const startLinkCode = parseStartLinkCode(text)
    const phoneLinkCode = parsePhoneLinkCode(text)
    const linkCode = startLinkCode || phoneLinkCode || contactPhone

    if (!startMessage && !linkCode) {
      const cooldown = checkAndSetAiCooldown(chatId)
      if (!cooldown.ok) {
        const waitSec = Math.max(1, Math.ceil(cooldown.waitMs / 1000))
        const sent = await sendTelegramMessage({
          chatId,
          text: `⏳ Iltimos, keyingi savoldan oldin <b>${waitSec} soniya</b> kuting.`
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending cooldown message', sent)
        }
        return NextResponse.json({ ok: true, rateLimited: true, waitSec })
      }

      const snapshot = await buildSnapshotByChatId(chatId)

      if (!snapshot) {
        const sent = await sendTelegramMessage({
          chatId,
          text: "ℹ️ Avval botni bog'lang: <code>/start +998901234567</code>"
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending link-instruction message', sent)
        }
        return NextResponse.json({ ok: true })
      }

      const aiText = buildBotModeReply({
        question: text,
        snapshot,
      })

      const sent = await sendTelegramMessage({
        chatId,
        text: `📘 <b>KEVIN BOT</b>\n\n${aiText}`,
        modeButtons: true,
      })
      if (!sent.ok) {
        console.error('Telegram webhook: failed sending AI response', sent)
      }
      return NextResponse.json({ ok: true })
    }

    if (!linkCode) {
      const alreadyLinked = await resolveParentByChatId(chatId)
      if (alreadyLinked) {
        const sent = await sendTelegramMessage({
          chatId,
          text: `✅ Bot allaqachon ulangan.\n\nHurmatli <b>${alreadyLinked.unpacked?.fullName || 'ota-ona'}</b>, endi sizga davomat va ball bo'yicha doimiy bildirishnomalar keladi.\n\nSiz bo‘limli savollarni <b>SAVOL UCHUN KEVIN BOT</b> tugmasi orqali bera olasiz.`,
          modeButtons: true,
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending already-linked message', sent)
        }
        return NextResponse.json({ ok: true, linked: true })
      }

      const sent = await sendTelegramContactRequestMessage({
        chatId,
        text: "👋 Kevin's Academy botiga xush kelibsiz!\n\nTez ulanish uchun pastdagi <b>Raqamni yuborish</b> tugmasini bosing.",
        buttonText: '📱 Raqamni yuborish',
      })
      if (!sent.ok) {
        console.error('Telegram webhook: failed sending contact-request message', sent)
      }
      return NextResponse.json({ ok: true })
    }

    const normalizedInputPhone = normalizePhoneForLinking(linkCode)
    if (!normalizedInputPhone) {
      const sent = await sendTelegramMessage({
        chatId,
        text: "❌ Telefon raqami noto'g'ri formatda.\nMisol: <code>/start +998901234567</code>"
      })
      if (!sent.ok) {
        console.error('Telegram webhook: failed sending invalid-phone message', sent)
      }
      return NextResponse.json({ ok: true })
    }

    await upsertTelegramPhoneLink({
      phone: normalizedInputPhone,
      chatId,
      username: fromUser?.username || undefined,
      firstName: fromUser?.first_name || undefined,
      lastName: fromUser?.last_name || undefined,
    })

    const parents = await prisma.parent.findMany({ orderBy: { createdAt: 'desc' } })
    let matchedParent: any = null

    for (const parent of parents) {
      const unpacked = unpackParent(parent) as any
      const normalizedParentPhone = normalizePhoneForLinking(unpacked?.phone || parent.phone)
      if (normalizedParentPhone && normalizedParentPhone === normalizedInputPhone) {
        matchedParent = { raw: parent, unpacked }
        break
      }
    }

    if (!matchedParent) {
      const sent = await sendTelegramMessage({
        chatId,
        text: "ℹ️ Telefon raqamingiz qabul qilindi.\nHozircha bu raqam bo'yicha ota-ona topilmadi.\nAdmin sizni tizimga qo'shganidan so'ng avtomatik ulanadi."
      })
      if (!sent.ok) {
        console.error('Telegram webhook: failed sending parent-not-found message', sent)
      }
      return NextResponse.json({ ok: true })
    }

    const existingMeta = decodeParentMetadata(matchedParent.raw.phone)
    const nextMetadata = {
      username: matchedParent.unpacked?.username || existingMeta?.username,
      password: matchedParent.unpacked?.password || existingMeta?.password,
      studentId: matchedParent.unpacked?.studentId || existingMeta?.studentId,
      studentIds: matchedParent.unpacked?.studentIds || existingMeta?.studentIds,
      phone: matchedParent.unpacked?.phone || existingMeta?.phone || matchedParent.raw.phone,
      telegramChatId: chatId,
    }

    await prisma.parent.update({
      where: { id: matchedParent.raw.id },
      data: {
        phone: encodeParentMetadata(nextMetadata)
      }
    })

    await updateParentBotStatusByChatId({
      adminId: matchedParent.raw?.adminId,
      studentId: Number(nextMetadata.studentId || 0) || undefined,
      chatId,
      status: 'CONNECTED',
    })

    const sent = await sendTelegramMessage({
      chatId,
      text: `✅ Telegram muvaffaqiyatli ulandi!\n\nHurmatli <b>${matchedParent.unpacked?.fullName || 'ota-ona'}</b>, endi sizga real-vaqtda bildirishnomalar yuboriladi.\n\nSavol berish uchun <b>SAVOL UCHUN KEVIN BOT</b> tugmasidan foydalaning.`,
      modeButtons: true,
    })
    if (!sent.ok) {
      console.error('Telegram webhook: failed sending success message', sent)
    }

    await sendRecentScoreHistoryToParent({
      chatId,
      parentRow: matchedParent.raw,
      unpacked: matchedParent.unpacked,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
