import TelegramBot from 'node-telegram-bot-api'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'

type SendTelegramMessageInput = {
  chatId: string
  text: string
  buttonUrl?: string
  buttonText?: string
  copyCardButtonText?: string
  copyCardCallbackData?: string
  aiButtonUrl?: string
  aiButtonText?: string
  botButtonUrl?: string
  botButtonText?: string
  extraButtons?: Array<{ text: string; url?: string; callbackData?: string }>
  modeButtons?: boolean
  activeMode?: 'ai' | 'bot'
}

type NotifyParentsInput = {
  adminId?: number | null
  studentId?: number | null
  text: string
  buttonUrl?: string
  buttonText?: string
  copyCardButtonText?: string
  copyCardCallbackData?: string
  aiButtonUrl?: string
  aiButtonText?: string
  botButtonUrl?: string
  botButtonText?: string
  includeContactButtons?: boolean
  modeButtons?: boolean
  activeMode?: 'ai' | 'bot'
}

type UpsertTelegramPhoneLinkInput = {
  phone: string
  chatId: string
  username?: string
  firstName?: string
  lastName?: string
}

type SendTelegramMessageResult =
  | { ok: true; fallback?: true }
  | { ok: false; reason: 'missing_token' | 'send_failed'; statusCode?: number; errorDescription?: string }

const PARENT_LEGACY_SELECT = {
  id: true,
  adminId: true,
  fullName: true,
  email: true,
  phone: true,
  createdAt: true,
} as const

function normalizeBotToken(raw?: string | null) {
  const value = String(raw || '').trim()
  if (!value) return ''

  const unquoted = value.replace(/^['"]+|['"]+$/g, '')
  const unwrapped = unquoted.startsWith('[') && unquoted.endsWith(']')
    ? unquoted.slice(1, -1).trim()
    : unquoted.startsWith('[')
      ? unquoted.slice(1).trim()
      : unquoted

  return unwrapped.trim()
}

function getBotTokens() {
  const candidates = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.telegramtoken,
    process.env.TELEGRAM_TOKEN,
    process.env.BOT_TOKEN,
  ]
    .map((item) => normalizeBotToken(item))
    .filter(Boolean)

  return Array.from(new Set(candidates))
}

function getBotToken() {
  const candidates = getBotTokens()

  return candidates[0] || ''
}

function getBot() {
  const token = getBotToken()
  if (!token) return null
  return new TelegramBot(token, { polling: false })
}

function normalizeTelegramUsername(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  let candidate = raw
    .replace(/^@+/, '')
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .split(/[/?#]/)[0]
    .trim()

  candidate = candidate.replace(/^@+/, '')
  if (!/^[A-Za-z0-9_]{5,32}$/.test(candidate)) return ''
  return candidate
}

function normalizeContactPhone(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('998')) return `+${digits}`
  if (digits.length === 9) return `+998${digits}`
  return raw.startsWith('+') ? raw : `+${digits}`
}

function digitsOnlyPhone(phone?: string | null) {
  return String(phone || '').replace(/\D/g, '')
}

async function getAdminContactButtons(adminId?: number | null) {
  let adminPhone = ''
  let adminTelegram = ''

  if (adminId) {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id: Number(adminId) },
        select: { contactPhone: true, telegramUsername: true },
      })
      adminPhone = normalizeContactPhone(admin?.contactPhone)
      adminTelegram = normalizeTelegramUsername(admin?.telegramUsername)
    } catch (error) {
      console.warn('Admin contact lookup skipped:', error)
    }
  }

  const fallbackPhone = normalizeContactPhone(
    process.env.DEFAULT_CONTACT_PHONE || process.env.SUPPORT_PHONE || process.env.NEXT_PUBLIC_CONTACT_PHONE || ''
  )
  const fallbackTelegram = normalizeTelegramUsername(
    process.env.DEFAULT_CONTACT_TELEGRAM_USERNAME || process.env.TELEGRAM_SUPPORT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_SUPPORT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || ''
  )

  const finalPhone = adminPhone || fallbackPhone
  const finalTelegram = adminTelegram || fallbackTelegram

  const buttons: Array<{ text: string; url?: string; callbackData?: string }> = []
  if (finalPhone) {
    const phoneDigits = digitsOnlyPhone(finalPhone)
    if (phoneDigits) {
      buttons.push({ text: '📞 Aloqa uchun', callbackData: `contact_phone:${phoneDigits}` })
    }
  }
  if (finalTelegram) {
    buttons.push({ text: '✈️ Mr Javohirga yozish', url: `https://t.me/${finalTelegram}` })
  }

  return buttons
}

function normalizePhone(phone?: string | null) {
  const raw = String(phone || '').trim()
  if (!raw) return ''

  let digits = raw.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    digits = `998${digits.slice(1)}`
  }

  if (digits.length === 9) {
    digits = `998${digits}`
  }

  if (digits.length > 12) {
    digits = digits.slice(-12)
  }

  return digits
}

function extractTelegramErrorMeta(error: unknown) {
  const err = error as {
    response?: {
      statusCode?: number
      body?: { error_code?: number; description?: string }
    }
    message?: string
  }

  const statusCode = Number(err?.response?.body?.error_code || err?.response?.statusCode || 0) || undefined
  const errorDescription = String(err?.response?.body?.description || err?.message || '').trim() || undefined
  return { statusCode, errorDescription }
}

function isDisconnectedTelegramError(input: { statusCode?: number; errorDescription?: string }) {
  const statusCode = Number(input.statusCode || 0)
  const description = String(input.errorDescription || '').toLowerCase()
  if (statusCode === 403) return true
  if (statusCode === 400 && /(chat not found|chat_id is empty|user not found|bot was blocked|user is deactivated|bot can't initiate conversation)/i.test(description)) return true
  if (/(forbidden|blocked by the user|chat not found|user is deactivated|bot can't initiate conversation)/i.test(description)) return true
  return false
}

function getLinkedParentStudentIds(unpacked: any) {
  const fromArray = Array.isArray(unpacked?.studentIds) ? unpacked.studentIds : []
  const unique = new Set<string>()

  for (const item of fromArray) {
    const normalized = String(item ?? '').trim()
    if (!normalized) continue
    unique.add(normalized)
  }

  const single = String(unpacked?.studentId ?? '').trim()
  if (single) unique.add(single)

  return Array.from(unique)
}

export async function updateParentBotStatusByChatId(input: {
  adminId?: number | null
  studentId?: number | null
  chatId: string
  status: 'CONNECTED' | 'DISCONNECTED'
  errorDescription?: string
}) {
  if (!input.chatId) return

  const parentDelegate = (prisma as any).parent
  if (!parentDelegate) return

  const parents = await parentDelegate.findMany({
    where: input.adminId ? { adminId: input.adminId } : undefined,
    select: PARENT_LEGACY_SELECT,
    orderBy: { createdAt: 'desc' },
  })

  const matchedParentIds: number[] = []

  for (const parent of parents) {
    const unpacked = unpackParent(parent) as any
    const linkedStudentIds = getLinkedParentStudentIds(unpacked)
    if (input.studentId) {
      const targetStudentId = String(input.studentId)
      const hasTargetStudent = linkedStudentIds.some((studentId) => studentId === targetStudentId)
      if (!hasTargetStudent) continue
    }

    const metadataChatId = String(unpacked?.telegramChatId || '').trim()
    const linkedChatId = metadataChatId || await findTelegramChatIdByPhone(unpacked?.phone || parent.phone)

    if (String(linkedChatId || '') !== String(input.chatId)) continue
    matchedParentIds.push(parent.id)
  }

  if (!matchedParentIds.length) return

  const now = new Date()
  await Promise.allSettled(
    matchedParentIds.map(async (parentId) => {
      const dbPayload =
        input.status === 'DISCONNECTED'
          ? {
              botStatus: 'DISCONNECTED',
              botDisconnectedAt: now,
              botLastCheckedAt: now,
              botLastError: String(input.errorDescription || 'Bot o‘chirildi yoki bloklandi').slice(0, 500),
            }
          : {
              botStatus: 'CONNECTED',
              botDisconnectedAt: null,
              botLastCheckedAt: now,
              botLastError: null,
            }

      try {
        await parentDelegate.update({
          where: { id: parentId },
          data: dbPayload,
        })
        return
      } catch {
        // legacy DB fallback (no botStatus columns)
      }

      try {
        const existingParent = await parentDelegate.findUnique({ where: { id: parentId }, select: PARENT_LEGACY_SELECT })
        if (!existingParent) return
        const existingMeta = decodeParentMetadata(existingParent.phone)
        const unpacked = unpackParent(existingParent) as any
        const nextMeta = {
          username: unpacked?.username || existingMeta?.username,
          password: unpacked?.password || existingMeta?.password,
          studentId: unpacked?.studentId || existingMeta?.studentId,
          studentIds: unpacked?.studentIds || existingMeta?.studentIds,
          phone: unpacked?.phone || existingMeta?.phone || existingParent.phone || undefined,
          telegramChatId: unpacked?.telegramChatId || existingMeta?.telegramChatId,
          botStatus: input.status,
          botDisconnectedAt: input.status === 'DISCONNECTED' ? now.toISOString() : undefined,
          botLastCheckedAt: now.toISOString(),
          botLastError: input.status === 'DISCONNECTED' ? String(input.errorDescription || 'Bot o‘chirildi yoki bloklandi').slice(0, 500) : undefined,
        }

        await parentDelegate.update({
          where: { id: parentId },
          data: {
            phone: encodeParentMetadata(nextMeta),
          },
        })
      } catch (fallbackError) {
        console.warn('Parent bot status metadata fallback skipped:', fallbackError)
      }
    })
  )
}

export function buildParentPortalUrl() {
  const base = process.env.PARENT_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/parent`
}

export function buildTelegramBotChatUrl() {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''
  if (!botUsername) return ''
  return `https://t.me/${botUsername}`
}

function toPlainTelegramText(text: string) {
  return String(text || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function clampTelegramText(text: string, limit = 3900) {
  const normalized = String(text || '').trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 2)).trimEnd()}…`
}

function toTelegramDateTime(value?: string | Date | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveTaskGroupChatIds(groupName: string) {
  const normalized = String(groupName || '').trim().toLowerCase()
  const key = normalized.replace(/[^a-z0-9]/g, '')

  const preIeltsEnv = process.env.TELEGRAM_GROUP_PRE_IELTS_CHAT_IDS || process.env.TELEGRAM_GROUP_PRE_IELTS_CHAT_ID || ''
  const cefrEnv = process.env.TELEGRAM_GROUP_CEFR_CHAT_IDS || process.env.TELEGRAM_GROUP_CEFR_CHAT_ID || ''
  const beginnerEnv = process.env.TELEGRAM_GROUP_BEGINNER_CHAT_IDS || process.env.TELEGRAM_GROUP_BEGINNER_CHAT_ID || ''
  const fallbackEnv =
    process.env.TELEGRAM_GROUP_DEFAULT_CHAT_IDS ||
    process.env.TELEGRAM_GROUP_DEFAULT_CHAT_ID ||
    process.env.TELEGRAM_GROUP_IDS ||
    process.env.TELEGRAM_GROUP_ID ||
    ''

  const raw = key.includes('preielts')
    ? preIeltsEnv
    : key.includes('cefr')
      ? cefrEnv
      : key.includes('beginner')
        ? beginnerEnv
        : fallbackEnv

  return String(raw || '')
    .split(/[\n,;]+/)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function formatTaskTelegramMessage(input: {
  groupName: string
  title: string
  contentText: string
  deadlineAt?: string | Date | null
  studentPanelUrl: string
}) {
  const today = toTelegramDateTime(new Date())
  const deadline = toTelegramDateTime(input.deadlineAt)
  const topic = clampTelegramText(toPlainTelegramText(input.title), 220)
  const taskBody = clampTelegramText(toPlainTelegramText(input.contentText), 1800)
  const safeGroup = clampTelegramText(toPlainTelegramText(input.groupName), 120)

  return [
    `📌 <b>YANGI VAZIFA | ${safeGroup}</b>`,
    '',
    `📅 <b>Sana:</b> ${today}`,
    `📝 <b>Mavzu:</b> ${topic || '-'}`,
    '',
    `📖 <b>Topshiriq:</b>`,
    taskBody || '-',
    '',
    `⏳ <b>Muddat:</b> ${deadline}`,
    `🔗 <b>Batafsil:</b> ${input.studentPanelUrl}`,
  ].join('\n')
}

function looksProfessionalTaskMessage(text: string) {
  const normalized = String(text || '').toLowerCase()
  const hasIntro = normalized.includes('bugungi darsimizni mustahkamlash')
  const hasGuide = normalized.includes("topshiriq yo‘riqnomasi") || normalized.includes("topshiriq yo'riqnomasi")
  return hasIntro && hasGuide
}

function isImageAttachment(attachmentType?: string | null, attachmentUrl?: string | null) {
  const type = String(attachmentType || '').toLowerCase()
  const url = String(attachmentUrl || '').toLowerCase()
  return type === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)
}

function buildTaskAttachmentCaption(input: {
  title: string
  groupName: string
  comment?: string | null
}) {
  const safeTitle = clampTelegramText(toPlainTelegramText(input.title), 180)
  const safeGroup = clampTelegramText(toPlainTelegramText(input.groupName), 120)
  const safeComment = clampTelegramText(toPlainTelegramText(String(input.comment || '')), 700)

  return [
    `📎 <b>${safeTitle || 'Biriktirilgan material'}</b>`,
    safeGroup ? `🏫 <b>Guruh:</b> ${safeGroup}` : '',
    safeComment ? `💬 <b>Izoh:</b> ${safeComment}` : '',
  ].filter(Boolean).join('\n')
}

async function sendTaskAttachmentToChat(input: {
  chatId: string
  attachmentUrl: string
  attachmentType?: string | null
  title: string
  groupName: string
  comment?: string | null
  studentPanelUrl: string
}) {
  const tokens = getBotTokens()
  if (!tokens.length) return { ok: false as const, reason: 'missing_token' as const }

  const caption = clampTelegramText(buildTaskAttachmentCaption({
    title: input.title,
    groupName: input.groupName,
    comment: input.comment,
  }), 1000)

  const replyMarkup = {
    inline_keyboard: [[{ text: 'Student Panel', url: input.studentPanelUrl }]],
  }

  for (const token of tokens) {
    const bot = new TelegramBot(token, { polling: false })
    try {
      if (isImageAttachment(input.attachmentType, input.attachmentUrl)) {
        await bot.sendPhoto(input.chatId, input.attachmentUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        } as any)
      } else {
        await bot.sendDocument(input.chatId, input.attachmentUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        } as any)
      }
      return { ok: true as const }
    } catch (error) {
      console.error('Telegram attachment send failed:', error)
    }
  }

  return { ok: false as const, reason: 'send_failed' as const }
}

export async function sendTelegramMessage(input: SendTelegramMessageInput): Promise<SendTelegramMessageResult> {
  const tokens = getBotTokens()
  if (!tokens.length) return { ok: false as const, reason: 'missing_token' }

  const inlineKeyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> = []

  if (input.buttonUrl) {
    if (input.copyCardCallbackData) {
      inlineKeyboard.push([
        { text: input.buttonText || "Batafsil ko'rish", url: input.buttonUrl },
        { text: input.copyCardButtonText || '📋 Kartani nusxalash', callback_data: input.copyCardCallbackData },
      ])
    } else {
      inlineKeyboard.push([{ text: input.buttonText || "Batafsil ko'rish", url: input.buttonUrl }])
    }
  } else if (input.copyCardCallbackData) {
    inlineKeyboard.push([
      { text: input.copyCardButtonText || '📋 Kartani nusxalash', callback_data: input.copyCardCallbackData },
    ])
  }

  if (input.modeButtons) {
    inlineKeyboard.push([
      { text: input.botButtonText || '❓ SAVOL UCHUN KEVIN BOT', callback_data: 'kevin_show_sections' },
    ] as any)
  } else {
    if (input.aiButtonUrl) {
      inlineKeyboard.push([{ text: input.aiButtonText || '🤖 SUNIY INTELLEKT JAVOBI', url: input.aiButtonUrl }])
    }

    if (input.botButtonUrl) {
      inlineKeyboard.push([{ text: input.botButtonText || "Kevin's Academy bot", url: input.botButtonUrl }])
    }
  }

  if (Array.isArray(input.extraButtons) && input.extraButtons.length) {
    for (const button of input.extraButtons) {
      if (!button?.text) continue
      if (button.callbackData) {
        inlineKeyboard.push([{ text: button.text, callback_data: button.callbackData }])
        continue
      }
      if (!button?.url) continue
      if (!/^https?:\/\//i.test(button.url)) continue
      inlineKeyboard.push([{ text: button.text, url: button.url }])
    }
  }

  const rawInputText = String(input.text || '').trim() || 'Yangi xabar mavjud'
  const htmlCandidate = rawInputText.length > 3900
    ? clampTelegramText(toPlainTelegramText(rawInputText), 3900)
    : rawInputText

  let lastFailure: SendTelegramMessageResult | null = null

  for (const token of tokens) {
    const bot = new TelegramBot(token, { polling: false })
    try {
      await bot.sendMessage(input.chatId, htmlCandidate, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(inlineKeyboard.length
          ? {
              reply_markup: {
                inline_keyboard: inlineKeyboard
              }
            }
          : {})
      })
      return { ok: true as const }
    } catch (error) {
      console.error('Telegram send error:', error)
      const primaryError = extractTelegramErrorMeta(error)
      try {
        const fallbackText = clampTelegramText(toPlainTelegramText(rawInputText), 3900)
        await bot.sendMessage(input.chatId, fallbackText || 'Yangi xabar mavjud', {
          disable_web_page_preview: true,
          ...(inlineKeyboard.length
            ? {
                reply_markup: {
                  inline_keyboard: inlineKeyboard
                }
              }
            : {})
        })
        return { ok: true as const, fallback: true as const }
      } catch (fallbackError) {
        console.error('Telegram fallback send error:', fallbackError)
        const fallbackMeta = extractTelegramErrorMeta(fallbackError)
        lastFailure = {
          ok: false as const,
          reason: 'send_failed',
          statusCode: fallbackMeta.statusCode || primaryError.statusCode,
          errorDescription: fallbackMeta.errorDescription || primaryError.errorDescription,
        }
      }
    }
  }

  return lastFailure || { ok: false as const, reason: 'send_failed' }
}

export async function answerTelegramCallbackQuery(input: { callbackQueryId: string; text?: string }) {
  const token = getBotToken()
  if (!token || !input.callbackQueryId) return { ok: false as const, reason: 'missing_token_or_id' }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: input.callbackQueryId, text: input.text || '' }),
    })

    if (!res.ok) {
      const raw = await res.text()
      console.error('Telegram answerCallbackQuery error:', raw)
      return { ok: false as const, reason: 'request_failed' }
    }

    return { ok: true as const }
  } catch (error) {
    console.error('Telegram answerCallbackQuery failed:', error)
    return { ok: false as const, reason: 'request_failed' }
  }
}

export async function verifyTelegramGroupConnection(chatId: string) {
  const token = getBotToken()
  const normalizedChatId = (() => {
    const raw = String(chatId || '').trim()
    if (!raw) return ''
    const unifiedMinus = raw
      .replace(/[−–—‒﹣－]/g, '-')
      .replace(/\s+/g, '')
    const extracted = unifiedMinus.match(/-?\d+/)?.[0] || ''
    if (!extracted) return ''
    return extracted.startsWith('-') ? extracted : `-${extracted}`
  })()
  if (!token) {
    return {
      ok: false as const,
      isAdmin: false,
      message: 'TELEGRAM_BOT_TOKEN topilmadi',
    }
  }

  if (!normalizedChatId) {
    return {
      ok: false as const,
      isAdmin: false,
      message: 'Telegram Group ID kiritilmagan',
    }
  }

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const meJson = await meRes.json().catch(() => null)
    const botId = Number(meJson?.result?.id || 0)
    const botUsername = String(meJson?.result?.username || '').trim()
    const botLabel = botUsername ? `@${botUsername}` : 'joriy bot'
    if (!meRes.ok || !Number.isFinite(botId) || botId <= 0) {
      return {
        ok: false as const,
        isAdmin: false,
        message: 'Bot ma’lumotini olishda xatolik. TELEGRAM_BOT_TOKEN ni tekshiring.',
      }
    }

    const memberRes = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: normalizedChatId,
        user_id: botId,
      }),
    })

    const memberJson = await memberRes.json().catch(() => null)
    if (!memberRes.ok || !memberJson?.ok) {
      const description = String(memberJson?.description || '').trim()
      const lower = description.toLowerCase()

      if (lower.includes('chat not found')) {
        return {
          ok: false as const,
          isAdmin: false,
          message: `Telegram chat topilmadi. Tekshirilgan bot: ${botLabel}, chat: ${normalizedChatId}. Agar ID to‘g‘ri bo‘lsa, shu botni guruhga qo‘shib admin qiling yoki production tokenni shu botnikiga almashtiring.`,
        }
      }

      if (lower.includes('bot is not a member') || lower.includes('user not found')) {
        return {
          ok: false as const,
          isAdmin: false,
          message: `Bot bu guruhda topilmadi (${botLabel}). Avval shu botni guruhga qo‘shing, so‘ng admin huquq bering.`,
        }
      }

      return {
        ok: false as const,
        isAdmin: false,
        message: description || 'Bot guruhga ulanmagan yoki chat ID noto‘g‘ri',
      }
    }

    const status = String(memberJson?.result?.status || '').toLowerCase()
    const isAdmin = status === 'administrator' || status === 'creator'
    if (!isAdmin) {
      return {
        ok: false as const,
        isAdmin: false,
        message: 'Bot guruhda admin emas. Iltimos, botga admin huquq bering',
      }
    }

    return {
      ok: true as const,
      isAdmin: true,
      message: `Muvaffaqiyatli bog‘landi ✅ (${botLabel} → ${normalizedChatId})`,
    }
  } catch (error: any) {
    return {
      ok: false as const,
      isAdmin: false,
      message: String(error?.message || 'Telegram tekshiruv xatosi'),
    }
  }
}

export async function sendTelegramContactRequestMessage(input: {
  chatId: string
  text: string
  buttonText?: string
}) {
  const token = getBotToken()
  if (!token || !input.chatId) return { ok: false as const, reason: 'missing_token_or_chat' }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: input.buttonText || '📱 Raqamni yuborish', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    })

    if (!res.ok) {
      const raw = await res.text()
      console.error('Telegram contact request sendMessage error:', raw)
      return { ok: false as const, reason: 'send_failed' }
    }

    return { ok: true as const }
  } catch (error) {
    console.error('Telegram contact request send failed:', error)
    return { ok: false as const, reason: 'send_failed' }
  }
}

export async function sendTelegramContactCard(input: {
  chatId: string
  phoneNumber: string
  firstName?: string
  lastName?: string
}) {
  const token = getBotToken()
  if (!token || !input.chatId) return { ok: false as const, reason: 'missing_token_or_chat' }

  const phoneDigits = digitsOnlyPhone(input.phoneNumber)
  if (!phoneDigits) return { ok: false as const, reason: 'invalid_phone' }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendContact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: input.chatId,
        phone_number: `+${phoneDigits}`,
        first_name: input.firstName || 'Aloqa',
        last_name: input.lastName || 'Kevin\'s Academy',
      }),
    })

    if (!res.ok) {
      const raw = await res.text()
      console.error('Telegram sendContact error:', raw)
      return { ok: false as const, reason: 'send_failed' }
    }

    return { ok: true as const }
  } catch (error) {
    console.error('Telegram sendContact failed:', error)
    return { ok: false as const, reason: 'send_failed' }
  }
}

export async function findLinkedParentChatIds(input: { adminId?: number | null; studentId?: number | null }) {
  if (!input.studentId) return [] as string[]
  const targetStudentId = Number(input.studentId)

  const collectChatIdsFromParents = async (parents: any[]) => {
    const chatIds = new Set<string>()

    for (const parent of parents) {
      const unpacked = unpackParent(parent) as any
      const linkedStudentIds = getLinkedParentStudentIds(unpacked)
      const hasTargetStudent = linkedStudentIds.some((studentId) => Number(studentId) === targetStudentId)
      if (!hasTargetStudent) {
        continue
      }

      const directChatId = unpacked?.telegramChatId ? String(unpacked.telegramChatId) : ''
      if (directChatId) {
        chatIds.add(directChatId)
      }

      const autoLinkedChatId = await findTelegramChatIdByPhone(unpacked?.phone || parent.phone)
      if (!autoLinkedChatId) {
        continue
      }

      chatIds.add(autoLinkedChatId)

      try {
        const existingMeta = decodeParentMetadata(parent.phone)
        const nextMetadata = {
          username: unpacked?.username || existingMeta?.username,
          password: unpacked?.password || existingMeta?.password,
          studentId: String(unpacked?.studentId || existingMeta?.studentId || targetStudentId),
          studentIds: unpacked?.studentIds || existingMeta?.studentIds || [String(targetStudentId)],
          phone: unpacked?.phone || existingMeta?.phone || parent.phone || undefined,
          telegramChatId: autoLinkedChatId,
        }

        await prisma.parent.update({
          where: { id: parent.id },
          data: {
            phone: encodeParentMetadata(nextMetadata),
          }
        })
      } catch (error) {
        console.warn('Parent telegram auto-link update skipped:', error)
      }
    }

    return Array.from(chatIds)
  }

  let parents = await prisma.parent.findMany({
    where: input.adminId ? { adminId: input.adminId } : undefined,
    select: PARENT_LEGACY_SELECT,
    orderBy: { createdAt: 'desc' }
  })

  const scopedChatIds = await collectChatIdsFromParents(parents)
  if (scopedChatIds.length > 0 || !input.adminId) {
    return scopedChatIds
  }

  parents = await prisma.parent.findMany({
    select: PARENT_LEGACY_SELECT,
    orderBy: { createdAt: 'desc' }
  })
  return collectChatIdsFromParents(parents)
}

export async function notifyParentsByStudentId(input: NotifyParentsInput) {
  try {
    const chatIds = await findLinkedParentChatIds({ adminId: input.adminId, studentId: input.studentId })
    if (!chatIds.length) return
    const defaultBotChatUrl = buildTelegramBotChatUrl()
    const useModeButtons = input.modeButtons ?? true
    const includeContactButtons = input.includeContactButtons ?? true
    const contactButtons = includeContactButtons ? await getAdminContactButtons(input.adminId) : []

    await Promise.allSettled(
      chatIds.map(async (chatId) => {
        const result = await sendTelegramMessage({
          chatId,
          text: input.text,
          buttonText: input.buttonText,
          buttonUrl: input.buttonUrl,
          aiButtonText: input.aiButtonText,
          aiButtonUrl: input.aiButtonUrl || (useModeButtons ? (defaultBotChatUrl || undefined) : undefined),
          botButtonText: input.botButtonText || (useModeButtons ? '❓ SAVOL UCHUN KEVIN BOT' : undefined),
          botButtonUrl: input.botButtonUrl || (useModeButtons ? (defaultBotChatUrl || undefined) : undefined),
          modeButtons: useModeButtons,
          activeMode: 'bot',
          copyCardButtonText: input.copyCardButtonText,
          copyCardCallbackData: input.copyCardCallbackData,
          extraButtons: contactButtons,
        })

        if (result.ok) {
          await updateParentBotStatusByChatId({
            adminId: input.adminId,
            studentId: input.studentId,
            chatId,
            status: 'CONNECTED',
          })
          return
        }

        if (isDisconnectedTelegramError(result)) {
          await updateParentBotStatusByChatId({
            adminId: input.adminId,
            studentId: input.studentId,
            chatId,
            status: 'DISCONNECTED',
            errorDescription: result.errorDescription,
          })
        }
      })
    )
  } catch (error) {
    console.error('Notify parents by student id failed:', error)
  }
}

export async function sendTaskToTelegramGroups(input: {
  groupName: string
  title: string
  contentText: string
  deadlineAt?: string | null
  studentPanelUrl: string
  chatIds?: string[]
  attachmentUrl?: string | null
  attachmentType?: string | null
  attachmentComment?: string | null
}) {
  const chatIds = Array.isArray(input.chatIds) && input.chatIds.length
    ? input.chatIds.map((item) => String(item || '').trim()).filter(Boolean)
    : resolveTaskGroupChatIds(input.groupName)
  if (!chatIds.length) {
    return {
      targetedChats: 0,
      deliveredChats: 0,
      failedChats: 0,
    }
  }

  const normalizedBody = clampTelegramText(toPlainTelegramText(input.contentText), 3600)
  const useRawProfessionalMessage = looksProfessionalTaskMessage(normalizedBody)

  const message = useRawProfessionalMessage
    ? normalizedBody
    : formatTaskTelegramMessage({
        groupName: input.groupName,
        title: input.title,
        contentText: input.contentText,
        deadlineAt: input.deadlineAt || null,
        studentPanelUrl: input.studentPanelUrl,
      })

  const settled = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const textResult = await sendTelegramMessage({
        chatId,
        text: message,
        buttonText: 'Student Panel',
        buttonUrl: input.studentPanelUrl,
      })

      if (!textResult.ok) {
        return textResult
      }

      const attachmentUrl = String(input.attachmentUrl || '').trim()
      if (!attachmentUrl) {
        return textResult
      }

      return sendTaskAttachmentToChat({
        chatId,
        attachmentUrl,
        attachmentType: input.attachmentType,
        title: input.title,
        groupName: input.groupName,
        comment: input.attachmentComment || null,
        studentPanelUrl: input.studentPanelUrl,
      })
    })
  )

  let deliveredChats = 0
  let failedChats = 0

  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value.ok) {
      deliveredChats += 1
    } else {
      failedChats += 1
    }
  }

  return {
    targetedChats: chatIds.length,
    deliveredChats,
    failedChats,
  }
}

export function queueTelegramTask(task: () => Promise<void>) {
  setTimeout(() => {
    task().catch((error) => {
      console.error('Queued telegram task failed:', error)
    })
  }, 0)
}

export function formatTelegramDate(value?: string | Date | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('uz-UZ')
}

export function normalizePhoneForLinking(phone?: string | null) {
  return normalizePhone(phone)
}

export function normalizePhoneForDisplay(phone?: string | null) {
  const normalized = normalizePhone(phone)
  return normalized ? `+${normalized}` : ''
}

export function buildTelegramStartLink(phone?: string | null) {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''
  const normalized = normalizePhoneForDisplay(phone)
  if (!botUsername || !normalized) return ''
  return `https://t.me/${botUsername}?start=${encodeURIComponent(normalized)}`
}

export async function findTelegramChatIdByPhone(phone?: string | null) {
  const normalized = normalizePhoneForLinking(phone)
  if (!normalized) return ''

  try {
    const telegramLinkDelegate = (prisma as any).telegramLink
    if (!telegramLinkDelegate) return ''
    const row = await telegramLinkDelegate.findUnique({ where: { phoneNormalized: normalized } })
    return row?.chatId ? String(row.chatId) : ''
  } catch (error) {
    console.warn('Telegram phone lookup skipped:', error)
    return ''
  }
}

export async function upsertTelegramPhoneLink(input: UpsertTelegramPhoneLinkInput) {
  const normalized = normalizePhoneForLinking(input.phone)
  if (!normalized || !input.chatId) return null

  try {
    const telegramLinkDelegate = (prisma as any).telegramLink
    if (!telegramLinkDelegate) return null

    const row = await telegramLinkDelegate.upsert({
      where: { phoneNormalized: normalized },
      create: {
        phoneNormalized: normalized,
        chatId: String(input.chatId),
        lastRawPhone: input.phone,
        lastUsername: input.username || null,
        lastFirstName: input.firstName || null,
        lastLastName: input.lastName || null,
      },
      update: {
        chatId: String(input.chatId),
        lastRawPhone: input.phone,
        lastUsername: input.username || null,
        lastFirstName: input.firstName || null,
        lastLastName: input.lastName || null,
      }
    })

    return row
  } catch (error) {
    console.warn('Telegram phone upsert skipped:', error)
    return null
  }
}
