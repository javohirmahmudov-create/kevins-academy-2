/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildSessionDayKey, isSessionStartedToday } from '@/lib/vocabulary'

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope required' }, { status: 401 })
    }

    const todayKey = buildSessionDayKey()
    const row = await prisma.vocabularySessionControl.findUnique({
      where: { adminId },
      select: {
        adminId: true,
        sessionDayKey: true,
        sessionActive: true,
        duelEnabled: true,
        startedAt: true,
        updatedAt: true,
      },
    })

    const startedToday = Boolean(row?.sessionActive) && isSessionStartedToday(row?.sessionDayKey || null)

    return NextResponse.json({
      adminId,
      todayKey,
      sessionStartedToday: startedToday,
      duelEnabled: startedToday ? Boolean(row?.duelEnabled) : false,
      readyForClass: startedToday && Boolean(row?.duelEnabled),
      startedAt: row?.startedAt || null,
      updatedAt: row?.updatedAt || null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope required' }, { status: 401 })
    }

    const body = await request.json()
    const action = String(body?.action || '').trim().toLowerCase()
    const duelEnabled = body?.duelEnabled === true

    const todayKey = buildSessionDayKey()

    const existing = await prisma.vocabularySessionControl.findUnique({
      where: { adminId },
      select: { id: true, sessionDayKey: true, sessionActive: true, duelEnabled: true },
    })

    if (action === 'start') {
      const updated = await prisma.vocabularySessionControl.upsert({
        where: { adminId },
        create: {
          adminId,
          sessionDayKey: todayKey,
          sessionActive: true,
          duelEnabled: true,
          startedAt: new Date(),
        },
        update: {
          sessionDayKey: todayKey,
          sessionActive: true,
          duelEnabled: true,
          startedAt: new Date(),
        },
      })
      return NextResponse.json({ ok: true, action: 'start', session: updated })
    }

    if (action === 'stop') {
      const updated = await prisma.vocabularySessionControl.upsert({
        where: { adminId },
        create: {
          adminId,
          sessionDayKey: todayKey,
          sessionActive: false,
          duelEnabled: false,
        },
        update: {
          sessionActive: false,
          duelEnabled: false,
        },
      })
      return NextResponse.json({ ok: true, action: 'stop', session: updated })
    }

    if (action === 'duel-mode') {
      const sessionValid = Boolean(existing?.sessionActive) && isSessionStartedToday(existing?.sessionDayKey || null)
      if (!sessionValid) {
        return NextResponse.json({ error: 'Avval bugungi sessionni boshlang' }, { status: 400 })
      }

      const updated = await prisma.vocabularySessionControl.update({
        where: { adminId },
        data: { duelEnabled },
      })
      return NextResponse.json({ ok: true, action: 'duel-mode', session: updated })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Xatolik') }, { status: 500 })
  }
}
