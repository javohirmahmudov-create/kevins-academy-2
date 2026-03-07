import prisma from '@/lib/prisma'
import { buildParentPortalUrl, buildTelegramBotChatUrl, notifyParentsByStudentId } from '@/lib/telegram'
import { findLinkedParentPhones, sendSms } from '@/lib/sms'

type NotificationType = 'score' | 'attendance' | 'payment'

type TelegramOptions = {
  buttonText?: string
  buttonUrl?: string
  copyCardButtonText?: string
  copyCardCallbackData?: string
  aiButtonText?: string
  aiButtonUrl?: string
  botButtonText?: string
  botButtonUrl?: string
  modeButtons?: boolean
}

type HybridNotificationInput = {
  adminId?: number | null
  studentId?: number | null
  type: NotificationType
  telegramText: string
  smsText: string
  telegramOptions?: TelegramOptions
}

type ScoreTemplateInput = {
  studentName: string
  subject: string
  scorePercent: number
  rank: number
  leaderboard?: Array<{ rank: number; studentName: string; score: number }>
  vocabularyWordList?: string[]
  vocabularySourceWordList?: string[]
  breakdown?: Record<string, any>
  aiSummary?: string
  maxScore?: number
  link?: string
}

type AttendanceTemplateInput = {
  studentName: string
}

type PaymentTemplateInput = {
  balanceAmount: number
}

function getFallbackPortalUrl() {
  return 'https://kevins-academy.com/parent'
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function getAdminChannelSettings(adminId?: number | null) {
  if (!adminId) {
    return { telegramEnabled: true, smsEnabled: true }
  }

  try {
    const adminDelegate = (prisma as any).admin
    const admin = await adminDelegate.findUnique({
      where: { id: Number(adminId) },
      select: { notifyTelegram: true, notifySms: true },
    })

    return {
      telegramEnabled: admin?.notifyTelegram ?? true,
      smsEnabled: admin?.notifySms ?? true,
    }
  } catch (error) {
    console.error('Admin notification settings lookup failed:', error)
    return { telegramEnabled: true, smsEnabled: true }
  }
}

async function writeNotificationLog(input: {
  channel: 'sms' | 'telegram'
  type: NotificationType
  status: 'sent' | 'failed'
  recipient?: string
  adminId?: number | null
  studentId?: number | null
  message: string
  error?: string
}) {
  try {
    const logDelegate = (prisma as any).notificationLog
    if (!logDelegate) return

    await logDelegate.create({
      data: {
        channel: input.channel,
        type: input.type,
        status: input.status,
        recipient: input.recipient || null,
        adminId: input.adminId || null,
        studentId: input.studentId || null,
        message: input.message,
        error: input.error || null,
      },
    })
  } catch (error) {
    console.error('Notification log write failed:', error)
  }
}

async function sendSmsForStudent(input: {
  adminId?: number | null
  studentId?: number | null
  type: NotificationType
  text: string
}) {
  const phones = await findLinkedParentPhones({ adminId: input.adminId, studentId: input.studentId })
  if (!phones.length) {
    await writeNotificationLog({
      channel: 'sms',
      type: input.type,
      status: 'failed',
      adminId: input.adminId,
      studentId: input.studentId,
      message: input.text,
      error: 'no_recipients',
    })
    return
  }

  await Promise.allSettled(
    phones.map(async (phone) => {
      const result = await sendSms({ to: phone, text: input.text })
      await writeNotificationLog({
        channel: 'sms',
        type: input.type,
        status: result.ok ? 'sent' : 'failed',
        recipient: phone,
        adminId: input.adminId,
        studentId: input.studentId,
        message: input.text,
        error: result.ok ? undefined : result.reason,
      })
    })
  )
}

export async function sendHybridNotification(input: HybridNotificationInput) {
  if (!input.studentId) return

  const { telegramEnabled } = await getAdminChannelSettings(input.adminId)
  const forceTelegram = String(process.env.TELEGRAM_FORCE_SEND || '0').trim() !== '0'
  const parentTelegramNotificationsEnabled = String(process.env.TELEGRAM_PARENT_NOTIFICATIONS_ENABLED || '0').trim() === '1'
  const tasks: Promise<any>[] = []

  if (parentTelegramNotificationsEnabled && (telegramEnabled || forceTelegram)) {
    tasks.push(
      notifyParentsByStudentId({
        adminId: input.adminId,
        studentId: input.studentId,
        text: input.telegramText,
        buttonText: input.telegramOptions?.buttonText,
        buttonUrl: input.telegramOptions?.buttonUrl,
        copyCardButtonText: input.telegramOptions?.copyCardButtonText,
        copyCardCallbackData: input.telegramOptions?.copyCardCallbackData,
        aiButtonText: input.telegramOptions?.aiButtonText,
        aiButtonUrl: input.telegramOptions?.aiButtonUrl,
        botButtonText: input.telegramOptions?.botButtonText,
        botButtonUrl: input.telegramOptions?.botButtonUrl,
        modeButtons: input.telegramOptions?.modeButtons,
      })
    )
  }

  // SMS yuborish vaqtincha o'chirilgan (Eskiz blok holatida).
  // Keyin qayta yoqish uchun quyidagi blokni uncomment qiling.
  // if (smsEnabled) {
  //   tasks.push(
  //     sendSmsForStudent({
  //       adminId: input.adminId,
  //       studentId: input.studentId,
  //       type: input.type,
  //       text: input.smsText,
  //     })
  //   )
  // }

  await Promise.all(tasks)
}

export function buildScoreTemplate(input: ScoreTemplateInput) {
  const link = input.link || buildParentPortalUrl() || getFallbackPortalUrl()
  const safeRank = Number(input.rank || 0)
  const rankLabel = safeRank > 0 ? `${safeRank}-o'rin` : "Noma'lum"
  const topList = (input.leaderboard || [])
    .slice(0, 3)
    .map((item) => {
      const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`
      return `${medal} ${escapeHtml(item.studentName)} — <b>${Number(item.score || 0).toFixed(1)}%</b>`
    })

  const sectionLabelMap: Record<string, string> = {
    vocabulary: 'Vocabulary',
    grammar: 'Grammar',
    translation: 'Translation',
    attendance: 'Attendance',
    listening: 'Listening',
    reading: 'Reading',
    speaking: 'Speaking',
    writing: 'Writing',
  }

  const sectionOrder = ['vocabulary', 'grammar', 'translation', 'attendance', 'listening', 'reading', 'speaking', 'writing']
  const breakdown = (input.breakdown && typeof input.breakdown === 'object') ? input.breakdown : {}
  const maxScore = Number(input.maxScore || 100) || 100

  const sectionRows = sectionOrder
    .filter((key) => breakdown[key])
    .map((key) => {
      const item = breakdown[key] || {}
      const rawScore = Number(item.score || 0)
      const safeScore = Number.isFinite(rawScore) ? rawScore : 0
      const itemMax = Number(item.maxScore || maxScore) || maxScore
      const safeMax = itemMax > 0 ? itemMax : 100
      const percent = Number(item.percent)
      const safePercent = Number.isFinite(percent) ? percent : (safeScore / safeMax) * 100
      return {
        label: sectionLabelMap[key] || key,
        score: `${safeScore.toFixed(1)}/${safeMax}`,
        percent: `${safePercent.toFixed(1)}%`,
      }
    })

  const sectionTable = sectionRows.length > 0
    ? [
        '<b>📌 Bo‘limlar bo‘yicha natija</b>',
        '<pre>Bo‘lim           Ball        Foiz</pre>',
        ...sectionRows.map((row) => {
          const label = row.label.padEnd(14, ' ')
          const score = row.score.padEnd(11, ' ')
          return `<pre>${escapeHtml(label)} ${escapeHtml(score)} ${escapeHtml(row.percent)}</pre>`
        })
      ]
    : []

  const knownWords = Array.from(new Set((input.vocabularyWordList || []).map((word) => String(word || '').trim().toLowerCase()).filter(Boolean)))
  const sourceWords = Array.from(new Set((input.vocabularySourceWordList || []).map((word) => String(word || '').trim().toLowerCase()).filter(Boolean)))
  const unknownWords = sourceWords.filter((word) => !knownWords.includes(word))

  const textParts = [
    `📊 <b>Yangi baholash natijasi</b>`,
    `👤 O‘quvchi: <b>${escapeHtml(input.studentName)}</b>`,
    `📘 Fan: <b>${escapeHtml(input.subject)}</b>`,
    `🏅 Reyting: <b>${rankLabel}</b>`,
  ]

  if (sectionTable.length > 0) {
    textParts.push('', ...sectionTable)
  }

  if (topList.length > 0) {
    textParts.push('', '<b>Guruh TOP-3:</b>', ...topList)
  }

  if (knownWords.length > 0 || sourceWords.length > 0) {
    textParts.push('', '<b>🧠 Lug‘at jadvali</b>')
  }

  if (knownWords.length > 0) {
    textParts.push(`<b>✅ Bilgan:</b> ${knownWords.map(escapeHtml).join(', ')}`)
  }

  if (unknownWords.length > 0) {
    textParts.push(`<b>❌ Bilmagan:</b> ${unknownWords.map(escapeHtml).join(', ')}`)
  }

  if (input.aiSummary) {
    textParts.push('', `<b>🤖 Kevin AI xulosa</b>`, escapeHtml(String(input.aiSummary)))
  }

  textParts.push('', `🔗 Batafsil: ${link}`)

  const text = textParts.join('\n')
  return { telegramText: text, smsText: text, link }
}

export function buildAttendanceTemplate(input: AttendanceTemplateInput) {
  const text = `Kevins Academy: Diqqat, ${input.studentName} bugun darsga kelmadi. Sababini aniqlang.`
  return { telegramText: text, smsText: text }
}

export function buildPaymentTemplate(input: PaymentTemplateInput) {
  const balance = Number(input.balanceAmount || 0).toLocaleString('uz-UZ')
  const text = `Kevins Academy: To'lov qabul qilindi. Balans: ${balance} so'm. Rahmat!`
  return { telegramText: text, smsText: text }
}

export async function sendScoreNotification(input: {
  adminId?: number | null
  studentId?: number | null
  studentName: string
  subject: string
  scorePercent: number
  maxScore?: number
  rank: number
  leaderboard?: Array<{ rank: number; studentName: string; score: number }>
  vocabularyWordList?: string[]
  vocabularySourceWordList?: string[]
  breakdown?: Record<string, any>
  aiSummary?: string
}) {
  if (!input.studentId) return
  const botChatUrl = buildTelegramBotChatUrl()
  const template = buildScoreTemplate({
    studentName: input.studentName,
    subject: input.subject,
    scorePercent: input.scorePercent,
    maxScore: input.maxScore,
    rank: input.rank,
    leaderboard: input.leaderboard,
    vocabularyWordList: input.vocabularyWordList,
    vocabularySourceWordList: input.vocabularySourceWordList,
    breakdown: input.breakdown,
    aiSummary: input.aiSummary,
  })

  await sendHybridNotification({
    adminId: input.adminId,
    studentId: input.studentId,
    type: 'score',
    telegramText: template.telegramText,
    smsText: template.smsText,
    telegramOptions: {
      buttonText: "Batafsil ko'rish",
      buttonUrl: template.link,
      botButtonText: '❓ SAVOL UCHUN KEVIN BOT',
      botButtonUrl: botChatUrl || undefined,
      modeButtons: true,
    },
  })
}

export async function sendAttendanceNotification(input: {
  adminId?: number | null
  studentId?: number | null
  studentName: string
}) {
  if (!input.studentId) return
  const botChatUrl = buildTelegramBotChatUrl()
  const template = buildAttendanceTemplate({ studentName: input.studentName })

  await sendHybridNotification({
    adminId: input.adminId,
    studentId: input.studentId,
    type: 'attendance',
    telegramText: template.telegramText,
    smsText: template.smsText,
    telegramOptions: {
      buttonText: "Batafsil ko'rish",
      buttonUrl: buildParentPortalUrl() || getFallbackPortalUrl(),
      botButtonText: '❓ SAVOL UCHUN KEVIN BOT',
      botButtonUrl: botChatUrl || undefined,
      modeButtons: true,
    },
  })
}

export async function sendPaymentNotification(input: {
  adminId?: number | null
  studentId?: number | null
  balanceAmount: number
  paymentUrl?: string
}) {
  if (!input.studentId) return
  const template = buildPaymentTemplate({ balanceAmount: input.balanceAmount })

  await sendHybridNotification({
    adminId: input.adminId,
    studentId: input.studentId,
    type: 'payment',
    telegramText: template.telegramText,
    smsText: template.smsText,
    telegramOptions: {
      buttonText: "💳 Karta orqali to'lash",
      buttonUrl: input.paymentUrl,
      copyCardButtonText: '📋 Kartani nusxalash',
      copyCardCallbackData: 'copy_card_details',
      modeButtons: false,
    },
  })
}
