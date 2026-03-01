import TelegramBot from 'node-telegram-bot-api'
import prisma from '@/lib/prisma'
import { unpackParent } from '@/lib/utils/parentAuth'

type SendTelegramMessageInput = {
  chatId: string
  text: string
  buttonUrl?: string
  buttonText?: string
}

type NotifyParentsInput = {
  adminId?: number | null
  studentId?: number | null
  text: string
  buttonUrl?: string
  buttonText?: string
}

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || ''
}

function getBot() {
  const token = getBotToken()
  if (!token) return null
  return new TelegramBot(token, { polling: false })
}

function normalizePhone(phone?: string | null) {
  return String(phone || '').replace(/[^\d+]/g, '').replace(/^00/, '+')
}

export function buildParentPortalUrl() {
  const base = process.env.PARENT_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/parent`
}

export async function sendTelegramMessage(input: SendTelegramMessageInput) {
  const bot = getBot()
  if (!bot) return { ok: false as const, reason: 'missing_token' }

  try {
    await bot.sendMessage(input.chatId, input.text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(input.buttonUrl
        ? {
            reply_markup: {
              inline_keyboard: [[{ text: input.buttonText || "Batafsil ko'rish", url: input.buttonUrl }]]
            }
          }
        : {})
    })
    return { ok: true as const }
  } catch (error) {
    console.error('Telegram send error:', error)
    return { ok: false as const, reason: 'send_failed' }
  }
}

export async function findLinkedParentChatIds(input: { adminId?: number | null; studentId?: number | null }) {
  if (!input.studentId) return [] as string[]

  const parents = await prisma.parent.findMany({
    where: input.adminId ? { adminId: input.adminId } : undefined,
    orderBy: { createdAt: 'desc' }
  })

  const chatIds = new Set<string>()

  for (const parent of parents) {
    const unpacked = unpackParent(parent) as any
    const linkedStudentId = unpacked?.studentId ? Number(unpacked.studentId) : null
    const chatId = unpacked?.telegramChatId ? String(unpacked.telegramChatId) : ''
    if (linkedStudentId === input.studentId && chatId) {
      chatIds.add(chatId)
    }
  }

  return Array.from(chatIds)
}

export async function notifyParentsByStudentId(input: NotifyParentsInput) {
  try {
    const chatIds = await findLinkedParentChatIds({ adminId: input.adminId, studentId: input.studentId })
    if (!chatIds.length) return

    for (const chatId of chatIds) {
      await sendTelegramMessage({
        chatId,
        text: input.text,
        buttonText: input.buttonText,
        buttonUrl: input.buttonUrl
      })
    }
  } catch (error) {
    console.error('Notify parents by student id failed:', error)
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
