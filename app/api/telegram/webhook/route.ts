import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { normalizePhoneForLinking, sendTelegramMessage, upsertTelegramPhoneLink } from '@/lib/telegram'

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
    const message = body?.message || body?.edited_message
    const chatId = message?.chat?.id ? String(message.chat.id) : ''
    const fromUser = message?.from || null
    const text = typeof message?.text === 'string'
      ? message.text
      : (typeof message?.caption === 'string' ? message.caption : '')

    if (!chatId || !text) {
      return NextResponse.json({ ok: true })
    }

    const linkCode = parseStartLinkCode(text)
    if (!linkCode) {
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

    const sent = await sendTelegramMessage({
      chatId,
      text: `✅ Telegram muvaffaqiyatli ulandi!\n\nHurmatli <b>${matchedParent.unpacked?.fullName || 'ota-ona'}</b>, endi sizga real-vaqtda bildirishnomalar yuboriladi.`,
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
