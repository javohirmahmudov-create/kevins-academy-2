import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { normalizePhoneForLinking, sendTelegramMessage } from '@/lib/telegram'

function parseStartLinkCode(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/start')) return ''
  const parts = trimmed.split(/\s+/)
  return parts[1] || ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = body?.message
    const chatId = message?.chat?.id ? String(message.chat.id) : ''
    const text = typeof message?.text === 'string' ? message.text : ''

    if (!chatId || !text) {
      return NextResponse.json({ ok: true })
    }

    const linkCode = parseStartLinkCode(text)
    if (!linkCode) {
      await sendTelegramMessage({
        chatId,
        text: "👋 Kevin's Academy botiga xush kelibsiz!\n\nTelegram bog'lash uchun quyidagicha yozing:\n<code>/start +998901234567</code>",
      })
      return NextResponse.json({ ok: true })
    }

    const normalizedInputPhone = normalizePhoneForLinking(linkCode)
    if (!normalizedInputPhone) {
      await sendTelegramMessage({
        chatId,
        text: "❌ Telefon raqami noto'g'ri formatda.\nMisol: <code>/start +998901234567</code>"
      })
      return NextResponse.json({ ok: true })
    }

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
      await sendTelegramMessage({
        chatId,
        text: "❌ Ushbu telefon raqami bo'yicha ota-ona topilmadi.\nIltimos, maktab administratori bilan bog'laning."
      })
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

    await sendTelegramMessage({
      chatId,
      text: `✅ Telegram muvaffaqiyatli ulandi!\n\nHurmatli <b>${matchedParent.unpacked?.fullName || 'ota-ona'}</b>, endi sizga real-vaqtda bildirishnomalar yuboriladi.`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
