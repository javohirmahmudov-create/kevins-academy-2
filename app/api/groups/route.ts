import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'

function getTelegramTokens() {
  const candidates = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.telegramtoken,
    process.env.TELEGRAM_TOKEN,
    process.env.BOT_TOKEN,
  ]
    .map((item) => String(item || '').trim().replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean)

  return Array.from(new Set(candidates))
}

function normalizeTelegramChatId(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const unifiedMinus = raw
    .replace(/[−–—‒﹣－]/g, '-')
    .replace(/\s+/g, '')

  const extracted = unifiedMinus.match(/-?\d+/)?.[0] || ''
  if (!extracted) return ''

  if (extracted.startsWith('-')) return extracted
  return `-${extracted}`
}

function isValidTelegramGroupId(value?: string | null) {
  const normalized = normalizeTelegramChatId(value)
  if (!normalized) return true
  return /^-100\d{6,}$/.test(normalized)
}

async function verifyTelegramGroupConnection(chatId: string) {
  const tokens = getTelegramTokens()
  const normalizedChatId = normalizeTelegramChatId(chatId)

  if (!tokens.length) {
    return {
      ok: false as const,
      isAdmin: false,
      message: 'Telegram bot token topilmadi (TELEGRAM_BOT_TOKEN/TELEGRAM_TOKEN)',
    }
  }

  if (!normalizedChatId) {
    return {
      ok: false as const,
      isAdmin: false,
      message: 'Telegram Group ID kiritilmagan',
    }
  }

  const diagnostics: string[] = []

  for (const token of tokens) {
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      const meJson = await meRes.json().catch(() => null)
      const botId = Number(meJson?.result?.id || 0)
      const botUsername = String(meJson?.result?.username || '').trim()
      const botLabel = botUsername ? `@${botUsername}` : 'joriy bot'

      if (!meRes.ok || !Number.isFinite(botId) || botId <= 0) {
        diagnostics.push(`${botLabel}: getMe xatolik`)
        continue
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
        diagnostics.push(`${botLabel}: ${description || 'guruhda topilmadi'}`)
        continue
      }

      const status = String(memberJson?.result?.status || '').toLowerCase()
      const isAdmin = status === 'administrator' || status === 'creator'
      if (!isAdmin) {
        diagnostics.push(`${botLabel}: admin emas (${status || 'unknown'})`)
        continue
      }

      return {
        ok: true as const,
        isAdmin: true,
        message: `Muvaffaqiyatli bog‘landi ✅ (${botLabel} → ${normalizedChatId})`,
      }
    } catch (error: any) {
      diagnostics.push(`xatolik: ${String(error?.message || 'unknown')}`)
    }
  }

  return {
    ok: false as const,
    isAdmin: false,
    message: `Telegram chat topilmadi yoki bot admin emas. Chat: ${normalizedChatId}. Tekshiruv: ${diagnostics.join(' | ')}`,
  }
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const groups = await prisma.group.findMany({
      where: adminId ? { adminId } : undefined,
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(groups)
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const adminId = getAdminIdFromRequest(req)
    const telegramChatId = normalizeTelegramChatId(body?.telegramChatId)

    if (!isValidTelegramGroupId(telegramChatId)) {
      return NextResponse.json({ error: 'Telegram Group ID noto‘g‘ri. -100... formatda kiriting' }, { status: 400 })
    }

    let verification: { ok: boolean; isAdmin?: boolean; message: string } | null = null
    if (telegramChatId) {
      const checked = await verifyTelegramGroupConnection(telegramChatId)
      verification = checked
      if (!checked.ok) {
        return NextResponse.json({ error: checked.message }, { status: 400 })
      }
    }

    const group = await prisma.group.create({
      data: {
        adminId,
        name: body.name,
        level: body.level,
        description: body.description,
        teacher: body.teacher,
        schedule: body.schedule,
        maxStudents: body.maxStudents,
        telegramChatId: telegramChatId || null,
      }
    })
    return NextResponse.json({ ...group, verification })
  } catch (error) {
    return NextResponse.json({ error: 'Yaratishda xatolik' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const adminId = getAdminIdFromRequest(req)
    if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 })
    const groupId = parseInt(id)

    if (adminId) {
      const owned = await prisma.group.findFirst({ where: { id: groupId, adminId } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }
    
    await prisma.group.delete({ where: { id: groupId } })
    return NextResponse.json({ message: 'Oʻchirildi' })
  } catch (error) {
    return NextResponse.json({ error: 'Oʻchirishda xatolik' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const adminId = getAdminIdFromRequest(req)
    const groupId = Number(id)

    if (!Number.isFinite(groupId) || groupId <= 0) {
      return NextResponse.json({ error: 'ID noto‘g‘ri' }, { status: 400 })
    }

    const existing = await prisma.group.findFirst({
      where: adminId ? { id: groupId, adminId } : { id: groupId },
      select: { id: true, telegramChatId: true },
    })

    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const telegramChatId = normalizeTelegramChatId(data?.telegramChatId)
    if (!isValidTelegramGroupId(telegramChatId)) {
      return NextResponse.json({ error: 'Telegram Group ID noto‘g‘ri. -100... formatda kiriting' }, { status: 400 })
    }

    let verification: { ok: boolean; isAdmin?: boolean; message: string } | null = null
    const prevTelegramChatId = normalizeTelegramChatId(existing.telegramChatId)
    const shouldVerifyTelegram = Boolean(telegramChatId) && telegramChatId !== prevTelegramChatId

    if (shouldVerifyTelegram) {
      const checked = await verifyTelegramGroupConnection(telegramChatId)
      verification = checked
      if (!checked.ok) {
        return NextResponse.json({ error: checked.message }, { status: 400 })
      }
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: data?.name,
        level: data?.level,
        description: data?.description,
        teacher: data?.teacher,
        schedule: data?.schedule,
        maxStudents: data?.maxStudents,
        telegramChatId: telegramChatId || null,
      },
    });
    return NextResponse.json({ ...updated, verification });
  } catch (error: any) {
    const prismaCode = String(error?.code || '')
    if (prismaCode === 'P2002') {
      return NextResponse.json({ error: 'Bunday guruh nomi allaqachon mavjud' }, { status: 409 })
    }
    return NextResponse.json({ error: String(error?.message || 'Update error') }, { status: 500 });
  }
}