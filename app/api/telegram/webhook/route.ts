import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { answerTelegramCallbackQuery, normalizePhoneForLinking, sendTelegramMessage, upsertTelegramPhoneLink } from '@/lib/telegram'

const AI_MIN_INTERVAL_MS = Number(process.env.TELEGRAM_AI_MIN_INTERVAL_MS || 3000)
const AI_COOLDOWN_CACHE_LIMIT = 5000
const aiRequestCooldownByChat = new Map<string, number>()
const chatAssistantModeByChat = new Map<string, 'ai' | 'bot'>()

type StudentInsightSnapshot = {
  parentName: string
  studentName: string
  group: string
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
  skills: Array<{ key: string; label: string; score: number; maxScore: number; percent: number }>
}

const SKILL_ALIASES: Record<string, string[]> = {
  listening: ['listening', 'eshitish', 'tinglab', 'tinglash'],
  reading: ['reading', 'o\'qish', 'oqish', 'matn'],
  speaking: ['speaking', 'gapirish', 'og\'zaki', 'ogzaki'],
  writing: ['writing', 'yozish', 'yozma'],
  grammar: ['grammar', 'grammatika'],
  vocabulary: ['vocabulary', 'lug\'at', 'lugat', 'word'],
  translation: ['translation', 'tarjima'],
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

function normalizeQuestion(question: string) {
  return String(question || '').trim().toLowerCase()
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
  if (!raw || typeof raw !== 'object') return [] as Array<{ key: string; label: string; score: number; maxScore: number; percent: number }>

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
      }
    })
    .filter((item) => Number.isFinite(item.percent))
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
  const mentionedSkillKey = getMentionedSkillKey(question, snapshot.skills)
  const mentionedSkill = snapshot.skills.find((item) => item.key === mentionedSkillKey)

  if (mentionedSkill) {
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
    const weakestKey = sortedSkills[0]?.key || 'grammar'
    const weeklyPlan = buildWeeklyPlanForSkill(weakestKey)
    const homework = buildHomeworkSuggestions(weakestKey)
    return [
      ...mainSummary,
      '',
      `🎯 Tahlil: Hozir ${trendText}.`,
      `${weakSkillsText ? `⚠️ Past ko‘nikmalar: ${weakSkillsText}.` : ''}`,
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
  const apiKey = process.env.GEMINI_API_KEY || ''
  if (!apiKey) return ''

  const configuredModels = (process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-1.5-flash')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 4500)
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 4500

  for (const model of configuredModels) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), safeTimeout)

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
            maxOutputTokens: 420,
          }
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const raw = await response.text()
        console.error(`Gemini API error (${model}):`, raw)
        continue
      }

      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text)
        .filter(Boolean)
        .join('\n')
        ?.trim()

      if (text) {
        return text
      }
    } catch (error) {
      console.error(`Gemini request failed (${model}):`, error)
    }
  }

  return ''
}

async function buildParentAssistantReply(input: {
  question: string
  snapshot: StudentInsightSnapshot
}) {
  const fastReply = buildInstantInsightReply(input.question, input.snapshot)

  const skillsTable = input.snapshot.skills.length
    ? input.snapshot.skills.map((item) => `${item.label}: ${item.score}/${item.maxScore} (${item.percent.toFixed(1)}%)`).join('; ')
    : "Ko'nikma kesimidagi ma'lumot yo'q"

  const prompt = [
    "Siz Kevin's Academy uchun ota-onalar yordamchi AI'sisiz.",
    'Faqat o\'zbek tilida, sodda va aniq javob bering. Javob tez va amaliy bo\'lsin.',
    'Foydalanuvchi istalgan mavzuda savol berishi mumkin; savolni rad qilmang va imkon qadar foydali javob bering.',
    'Agar ma\'lumot yetarli bo\'lmasa, taxmin qilmang va nimasi yetishmayotganini ayting.',
    'Maktab ichki ma\'lumotlari asosida bolaning holatini izohlang va amaliy tavsiya bering.',
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
    `<SKILL_TABLE>${skillsTable}</SKILL_TABLE>`,
    '',
    `Savol: ${input.question}`,
    '',
    'Javob formati: 1) Qisqa holat 2) Sabab tahlili 3) 2-3 ta amaliy tavsiya.',
    'Agar savolda fan/ko‘nikma so‘ralsa, aynan o‘sha ko‘nikma bo‘yicha javob bering.',
    'Agar foydali manba yoki mashq so‘ralsa, kamida 2 ta YouTube link bering.'
  ].join('\n')

  const aiText = await askGeminiWithFallback(prompt)
  if (aiText) {
    return aiText
  }

  return [
    '⚠️ KEVIN AI vaqtincha to‘liq javob bera olmadi.',
    'Iltimos, savolni 5-10 soniyadan keyin qayta yuboring.',
    '',
    'Quyida tezkor tizim tahlili:',
    fastReply,
  ].join('\n')
}

function buildBotModeReply(input: { question: string; snapshot: StudentInsightSnapshot }) {
  if (!isBotAllowedQuestion(input.question)) {
    return [
      '📘 <b>KEVIN BOT rejimi</b>',
      '',
      'Men faqat quyidagi yo\'nalishlarda javob bera olaman:',
      '• davomat holati',
      '• umumiy ball va trend',
      '• guruh reytingi',
      '• to\'lov holati',
      '• skills (listening/reading/speaking/writing/...)',
      '• reja, uyga vazifa, YouTube tavsiyasi',
      '',
      'Namuna savollar:',
      '• Davomat nega pasaydi?',
      '• Listening bo\'yicha reja ber',
      '• Guruh reytingida nechanchi o\'rin?',
      '',
      'Erkin savol-javob uchun <b>KEVIN AI</b> tugmasini bosing.'
    ].join('\n')
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
    const callbackQuery = body?.callback_query

    if (callbackQuery?.id && callbackQuery?.message?.chat?.id) {
      const chatId = String(callbackQuery.message.chat.id)
      const data = String(callbackQuery.data || '')

      if (data === 'kevin_mode_ai' || data === 'kevin_mode_bot') {
        const nextMode: 'ai' | 'bot' = data === 'kevin_mode_ai' ? 'ai' : 'bot'
        chatAssistantModeByChat.set(chatId, nextMode)

        await answerTelegramCallbackQuery({
          callbackQueryId: String(callbackQuery.id),
          text: nextMode === 'ai' ? 'KEVIN AI rejimi yoqildi' : 'KEVIN BOT rejimi yoqildi',
        })

        const linkedParent = await resolveParentByChatId(chatId)
        const parentName = linkedParent?.unpacked?.fullName || 'ota-ona'
        const modeText = nextMode === 'ai'
          ? `🤖 <b>KEVIN AI yoqildi</b>\n\nHurmatli <b>${parentName}</b>, endi farzandingiz bo\'yicha erkin savollarni bemalol bering.`
          : `📘 <b>KEVIN BOT yoqildi</b>\n\nHurmatli <b>${parentName}</b>, endi men faqat tizimdagi tayyor yo\'nalishlar bo\'yicha javob beraman.`

        const sent = await sendTelegramMessage({
          chatId,
          text: modeText,
          modeButtons: true,
          activeMode: nextMode,
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending mode-switch message', sent)
        }

        return NextResponse.json({ ok: true, mode: nextMode })
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
    const startMessage = isStartCommand(text)

    if (!chatId || !text) {
      return NextResponse.json({ ok: true })
    }

    const startLinkCode = parseStartLinkCode(text)
    const phoneLinkCode = parsePhoneLinkCode(text)
    const linkCode = startLinkCode || phoneLinkCode

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

      const linkedParent = await resolveParentByChatId(chatId)

      if (!linkedParent) {
        const sent = await sendTelegramMessage({
          chatId,
          text: "ℹ️ Avval botni bog'lang: <code>/start +998901234567</code>"
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending link-instruction message', sent)
        }
        return NextResponse.json({ ok: true })
      }

      const linkedStudentId = linkedParent?.unpacked?.studentId ? Number(linkedParent.unpacked.studentId) : null
      const student = linkedStudentId
        ? await prisma.student.findUnique({ where: { id: linkedStudentId }, select: { id: true, fullName: true, group: true, adminId: true } })
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
      const snapshot: StudentInsightSnapshot = {
        parentName: linkedParent?.unpacked?.fullName || linkedParent?.raw?.fullName || 'Ota-ona',
        studentName: student?.fullName || 'Noma\'lum',
        group: student?.group || 'Noma\'lum',
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

      const mode = chatAssistantModeByChat.get(chatId) || 'bot'
      const aiText = mode === 'ai'
        ? await buildParentAssistantReply({
            question: text,
            snapshot,
          })
        : buildBotModeReply({
            question: text,
            snapshot,
          })

      const sent = await sendTelegramMessage({
        chatId,
        text: `${mode === 'ai' ? '🤖 <b>KEVIN AI</b>' : '📘 <b>KEVIN BOT</b>'}\n\n${aiText}`,
        modeButtons: true,
        activeMode: mode,
      })
      if (!sent.ok) {
        console.error('Telegram webhook: failed sending AI response', sent)
      }
      return NextResponse.json({ ok: true })
    }

    if (!linkCode) {
      const alreadyLinked = await resolveParentByChatId(chatId)
      if (alreadyLinked) {
        chatAssistantModeByChat.set(chatId, 'bot')
        const sent = await sendTelegramMessage({
          chatId,
          text: `✅ Bot allaqachon ulangan.\n\nHurmatli <b>${alreadyLinked.unpacked?.fullName || 'ota-ona'}</b>, endi sizga davomat va ball bo'yicha doimiy bildirishnomalar keladi.\n\nHozirgi rejim: <b>KEVIN BOT</b>. Erkin AI savollar uchun <b>KEVIN AI</b> tugmasini bosing.`,
          modeButtons: true,
          activeMode: 'bot',
        })
        if (!sent.ok) {
          console.error('Telegram webhook: failed sending already-linked message', sent)
        }
        return NextResponse.json({ ok: true, linked: true })
      }

      const sent = await sendTelegramMessage({
        chatId,
        text: "👋 Kevin's Academy botiga xush kelibsiz!\n\nTelegram bog'lash uchun O'ZINGIZNING telefon raqamingiz bilan yozing:\n<code>/start +9989XXXXXXXX</code>\n\nMasalan: <code>/start +998954403969</code>",
      })
      if (!sent.ok) {
        console.error('Telegram webhook: failed sending welcome message', sent)
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
      phone: matchedParent.unpacked?.phone || existingMeta?.phone || matchedParent.raw.phone,
      telegramChatId: chatId,
    }

    await prisma.parent.update({
      where: { id: matchedParent.raw.id },
      data: {
        phone: encodeParentMetadata(nextMetadata)
      }
    })

    chatAssistantModeByChat.set(chatId, 'bot')

    const sent = await sendTelegramMessage({
      chatId,
      text: `✅ Telegram muvaffaqiyatli ulandi!\n\nHurmatli <b>${matchedParent.unpacked?.fullName || 'ota-ona'}</b>, endi sizga real-vaqtda bildirishnomalar yuboriladi.\n\nHozirgi rejim: <b>KEVIN BOT</b>. Erkin AI savollar uchun <b>KEVIN AI</b> tugmasini bosing.`,
      modeButtons: true,
      activeMode: 'bot',
    })
    if (!sent.ok) {
      console.error('Telegram webhook: failed sending success message', sent)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
