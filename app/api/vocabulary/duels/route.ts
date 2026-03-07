/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildTelegramStartLink, findTelegramChatIdByPhone } from '@/lib/telegram'
import { buildSessionDayKey, isSessionStartedToday, sendHybridVocabularyNotification } from '@/lib/vocabulary'

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null
  const index = Math.floor(Math.random() * items.length)
  return items[index] || null
}

function getAppBase(request: Request) {
  const envBase = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim()
  if (envBase) return envBase.replace(/\/$/, '')
  try {
    return new URL(request.url).origin
  } catch {
    return ''
  }
}

async function getSessionState(adminId?: number | null) {
  if (!adminId) {
    return {
      sessionStartedToday: false,
      duelEnabled: false,
      readyForClass: false,
    }
  }

  const row = await prisma.vocabularySessionControl.findUnique({
    where: { adminId: Number(adminId) },
    select: { sessionDayKey: true, sessionActive: true, duelEnabled: true },
  })

  const sessionStartedToday = Boolean(row?.sessionActive) && isSessionStartedToday(row?.sessionDayKey || null)
  const duelEnabled = sessionStartedToday ? Boolean(row?.duelEnabled) : false

  return {
    sessionStartedToday,
    duelEnabled,
    readyForClass: sessionStartedToday && duelEnabled,
  }
}

export async function GET(request: Request) {
  try {
    const scopedAdminId = getAdminIdFromRequest(request)
    const url = new URL(request.url)
    const studentId = Number(url.searchParams.get('studentId') || 0)

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, adminId: true, phone: true },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (scopedAdminId && student.adminId && scopedAdminId !== student.adminId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminId = student.adminId || scopedAdminId || undefined
    const rows = await prisma.vocabularyDuel.findMany({
      where: {
        ...(adminId ? { adminId } : {}),
        OR: [{ challengerId: student.id }, { opponentId: student.id }],
        status: { in: ['pending', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        challengerId: true,
        opponentId: true,
        status: true,
        initiatorMode: true,
        createdAt: true,
        acceptedAt: true,
        meta: true,
      },
    })

    const personIds = Array.from(new Set(rows.flatMap((row) => [Number(row.challengerId), Number(row.opponentId)])))
    const people = await prisma.student.findMany({
      where: { id: { in: personIds } },
      select: { id: true, fullName: true },
    })
    const personMap = new Map(people.map((person) => [Number(person.id), person]))

    const mapped = rows.map((row) => {
      const challenger = personMap.get(Number(row.challengerId))
      const opponent = personMap.get(Number(row.opponentId))
      const incoming = Number(row.opponentId) === student.id && row.status === 'pending'
      return {
        ...row,
        challengerName: challenger?.fullName || `#${row.challengerId}`,
        opponentName: opponent?.fullName || `#${row.opponentId}`,
        incoming,
      }
    })

    const session = await getSessionState(adminId)
    const botChatId = await findTelegramChatIdByPhone(student.phone)
    const botLink = buildTelegramStartLink(student.phone)

    return NextResponse.json({
      duels: mapped,
      pendingIncoming: mapped.filter((item) => item.status === 'pending' && item.incoming),
      pendingOutgoing: mapped.filter((item) => item.status === 'pending' && !item.incoming),
      activeDuel: mapped.find((item) => item.status === 'active') || null,
      session,
      bot: {
        linked: Boolean(botChatId),
        startLink: botLink || null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const scopedAdminId = getAdminIdFromRequest(request)
    const body = await request.json()

    const challengerId = Number(body?.studentId || body?.challengerId || 0)
    let opponentId = Number(body?.opponentId || 0)
    const mode = String(body?.mode || 'manual').trim().toLowerCase() === 'random' ? 'random' : 'manual'

    if (!Number.isFinite(challengerId) || challengerId <= 0) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const challenger = await prisma.student.findUnique({
      where: { id: challengerId },
      select: { id: true, fullName: true, group: true, adminId: true, phone: true },
    })

    if (!challenger) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (scopedAdminId && challenger.adminId && scopedAdminId !== challenger.adminId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!challenger.group) {
      return NextResponse.json({ error: 'Student group required' }, { status: 400 })
    }

    const session = await getSessionState(challenger.adminId || scopedAdminId)
    if (!session.readyForClass) {
      return NextResponse.json({ error: 'Duel rejimi hozir o‘chiq. Admin bugungi sessionni boshlasin va Duel mode ni yoqsin.' }, { status: 400 })
    }

    const challengerChatId = await findTelegramChatIdByPhone(challenger.phone)
    if (!challengerChatId) {
      const connectLink = buildTelegramStartLink(challenger.phone)
      return NextResponse.json({
        error: 'Iltimos, avval Kevin Botni ulang. Ulanmasangiz duel chaqiruvlarini ololmaysiz.',
        connectBotUrl: connectLink || null,
      }, { status: 400 })
    }

    if (!opponentId || mode === 'random') {
      const candidates = await prisma.student.findMany({
        where: {
          group: challenger.group,
          ...(challenger.adminId ? { adminId: challenger.adminId } : {}),
          id: { not: challenger.id },
        },
        select: { id: true },
      })
      const picked = pickRandom(candidates)
      opponentId = Number(picked?.id || 0)
    }

    if (!Number.isFinite(opponentId) || opponentId <= 0 || opponentId === challenger.id) {
      return NextResponse.json({ error: 'Valid opponent required' }, { status: 400 })
    }

    const opponent = await prisma.student.findUnique({
      where: { id: opponentId },
      select: { id: true, fullName: true, group: true, phone: true, adminId: true },
    })

    if (!opponent) {
      return NextResponse.json({ error: 'Opponent not found' }, { status: 404 })
    }

    if ((opponent.group || '') !== (challenger.group || '') || (opponent.adminId || null) !== (challenger.adminId || null)) {
      return NextResponse.json({ error: 'Opponent group mismatch' }, { status: 400 })
    }

    const existing = await prisma.vocabularyDuel.findFirst({
      where: {
        ...(challenger.adminId ? { adminId: challenger.adminId } : {}),
        status: { in: ['pending', 'active'] },
        OR: [
          { challengerId: challenger.id, opponentId: opponent.id },
          { challengerId: opponent.id, opponentId: challenger.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, challengerId: true, opponentId: true, createdAt: true },
    })

    if (existing) {
      return NextResponse.json({ ok: true, duel: existing, existed: true })
    }

    const duel = await prisma.vocabularyDuel.create({
      data: {
        adminId: challenger.adminId || undefined,
        challengerId: challenger.id,
        opponentId: opponent.id,
        initiatorMode: mode,
        status: 'pending',
        meta: {
          challengerName: challenger.fullName,
          opponentName: opponent.fullName,
          group: challenger.group,
          invitedAt: new Date().toISOString(),
        },
      },
      select: {
        id: true,
        status: true,
        challengerId: true,
        opponentId: true,
        createdAt: true,
        initiatorMode: true,
      },
    })

    const base = getAppBase(request)
    const duelUrl = `${base}/student/vocabulary?tab=peer&duel=${duel.id}`
    const duelText = `🔥 Vocabulary duel chaqiruvi!\n${challenger.fullName} sizni duelga taklif qildi.`

    const directChatId = await findTelegramChatIdByPhone(opponent.phone)
    const group = await prisma.group.findFirst({
      where: {
        name: challenger.group,
        ...(challenger.adminId ? { adminId: challenger.adminId } : {}),
      },
      select: { telegramChatId: true },
    })

    const notifyResult = await sendHybridVocabularyNotification({
      adminId: challenger.adminId || null,
      studentId: opponent.id,
      type: 'vocabulary_duel_invite',
      inAppMessage: `Duel invite from ${challenger.fullName} to ${opponent.fullName}`,
      telegramText: directChatId
        ? duelText
        : `🔥 ${opponent.fullName}, sizga vocabulary duel bor!\nTaklif: ${challenger.fullName}`,
      buttonUrl: duelUrl,
      buttonText: directChatId ? 'Duelni ochish' : 'Duelga kirish',
      directChatId: directChatId || undefined,
      groupChatId: directChatId ? undefined : String(group?.telegramChatId || ''),
    })

    return NextResponse.json({
      ok: true,
      duel,
      notified: {
        channel: notifyResult.telegramChannel !== 'none' ? notifyResult.telegramChannel : 'inapp',
        hasError: Boolean(notifyResult.telegramChannel !== 'none' && !notifyResult.telegramSent),
        inAppSent: notifyResult.inAppSent,
      },
      readyForClass: true,
      todayKey: buildSessionDayKey(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
