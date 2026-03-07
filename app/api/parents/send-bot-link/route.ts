import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { unpackParent } from '@/lib/utils/parentAuth'
import { buildTelegramStartLink, findTelegramChatIdByPhone, sendTelegramMessage, updateParentBotStatusByChatId } from '@/lib/telegram'
import { sendSms } from '@/lib/sms'

function normalizePhoneForSms(phone?: string | null) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9) digits = `998${digits}`
  if (digits.length === 10 && digits.startsWith('0')) digits = `998${digits.slice(1)}`
  if (digits.length !== 12 || !digits.startsWith('998')) return ''

  return `+${digits}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parentId = Number(body?.parentId)
    if (!parentId) {
      return NextResponse.json({ error: 'Missing parentId' }, { status: 400 })
    }

    const parent = await prisma.parent.findUnique({ where: { id: parentId } })
    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
    }

    const unpacked = unpackParent(parent) as any
    const phone = normalizePhoneForSms(unpacked?.phone || parent.phone)
    const botLink = buildTelegramStartLink(phone)

    if (!phone || !botLink) {
      return NextResponse.json({
        ok: false,
        reason: 'link_not_available',
        botLink,
      })
    }

    const chatId = String(unpacked?.telegramChatId || '').trim() || await findTelegramChatIdByPhone(phone)
    if (chatId) {
      const telegramText = [
        `👋 Salom, <b>${String(parent.fullName || 'ota-ona')}</b>!`,
        '',
        `Kevin's Academy botini ishga tushirish uchun pastdagi tugmani bosing:`,
      ].join('\n')

      const telegramResult = await sendTelegramMessage({
        chatId,
        text: telegramText,
        buttonText: '🚀 Botni ochish',
        buttonUrl: botLink,
      })

      if (telegramResult.ok) {
        await updateParentBotStatusByChatId({
          adminId: parent.adminId,
          chatId,
          status: 'CONNECTED',
        })

        return NextResponse.json({
          ok: true,
          via: 'telegram',
          botLink,
          phone,
        })
      }
    }

    const text = `Kevin's Academy: Telegram botga ulanish uchun shu linkni oching: ${botLink}`
    const smsResult = await sendSms({ to: phone, text })

    if (!smsResult.ok) {
      return NextResponse.json({
        ok: false,
        reason: 'parent_must_start',
        botLink,
        phone,
      })
    }

    return NextResponse.json({
      ok: true,
      via: 'sms',
      botLink,
      phone,
    })
  } catch (error) {
    console.error('POST /api/parents/send-bot-link error:', error)
    return NextResponse.json({ ok: false, error: 'Xatolik' }, { status: 500 })
  }
}
