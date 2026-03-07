import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decodeParentMetadata, encodeParentMetadata, unpackParent } from '@/lib/utils/parentAuth'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { buildTelegramStartLink, findTelegramChatIdByPhone, normalizePhoneForDisplay, normalizePhoneForLinking, sendTelegramMessage } from '@/lib/telegram'

const PARENT_LEGACY_SELECT = {
  id: true,
  adminId: true,
  fullName: true,
  email: true,
  phone: true,
  createdAt: true,
} as const

function cleanString(value: unknown) {
  return String(value || '').trim()
}

function parseStudentIds(input: unknown, fallbackStudentId?: unknown) {
  const fromArray = Array.isArray(input) ? input : []
  const fallback = cleanString(fallbackStudentId)
  const unique = new Set<string>()

  for (const item of fromArray) {
    const normalized = cleanString(item)
    if (!normalized) continue
    unique.add(normalized)
  }

  if (fallback) unique.add(fallback)
  return Array.from(unique)
}

function getPrimaryStudentId(studentIds: string[]) {
  return studentIds[0] || ''
}

function isParentMetadataPayload(value: unknown) {
  const text = cleanString(value)
  return Boolean(text && text.startsWith('__KA_PARENT__:'))
}

function parseApiErrorMessage(error: any) {
  const prismaCode = String(error?.code || '')
  if (prismaCode === 'P2002') return 'Bunday maʼlumot allaqachon mavjud'
  if (prismaCode === 'P2003') return 'Bogʻlangan maʼlumot topilmadi'
  return String(error?.message || 'Xatolik')
}

function isMissingBotStatusColumnError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('column') && message.includes('botstatus') && message.includes('does not exist')
}

async function createParentLegacy(input: {
  adminId?: number | null
  fullName: string
  email?: string | null
  phone: string | null
}) {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number
    adminId: number | null
    fullName: string
    email: string | null
    phone: string | null
    createdAt: Date
  }>>(
    `
      INSERT INTO "Parent" ("adminId", "fullName", "email", "phone", "createdAt")
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING "id", "adminId", "fullName", "email", "phone", "createdAt"
    `,
    input.adminId ?? null,
    input.fullName,
    input.email,
    input.phone,
  )

  return rows?.[0] || null
}

async function hasDuplicateParentUsername(input: {
  adminId?: number | null
  username: string
  ignoreParentId?: number
}) {
  const username = cleanString(input.username).toLowerCase()
  if (!username) return false

  const parentRows = await prisma.parent.findMany({
    where: input.adminId ? { adminId: input.adminId } : undefined,
    select: { id: true, phone: true },
    orderBy: { createdAt: 'desc' },
  })

  for (const row of parentRows) {
    if (input.ignoreParentId && Number(row.id) === Number(input.ignoreParentId)) continue
    const meta = decodeParentMetadata(row.phone)
    const existing = cleanString(meta?.username).toLowerCase()
    if (existing && existing === username) return true
  }

  return false
}

async function hasDuplicateParentPhone(input: {
  adminId?: number | null
  phone?: string | null
  ignoreParentId?: number
}) {
  const normalizedPhone = normalizePhoneForLinking(input.phone)
  if (!normalizedPhone) return false

  const parentRows = await prisma.parent.findMany({
    where: input.adminId ? { adminId: input.adminId } : undefined,
    select: { id: true, phone: true },
    orderBy: { createdAt: 'desc' },
  })

  for (const row of parentRows) {
    if (input.ignoreParentId && Number(row.id) === Number(input.ignoreParentId)) continue
    const unpacked = unpackParent(row) as any
    const existingPhone = normalizePhoneForLinking(unpacked?.phone || row.phone)
    if (existingPhone && existingPhone === normalizedPhone) {
      return true
    }
  }

  return false
}

async function resolveStudentName(studentId?: string) {
  const parsed = Number(studentId || '')
  if (!Number.isFinite(parsed) || parsed <= 0) return "o'quvchi"
  const student = await prisma.student.findUnique({ where: { id: parsed }, select: { fullName: true } })
  return student?.fullName || "o'quvchi"
}

async function maybeSendParentWelcome(input: {
  chatId?: string
  parentName?: string
  studentName?: string
}) {
  if (!input.chatId) return
  const text = `🎉 <b>Xush kelibsiz!</b>\n\nHurmatli <b>${input.parentName || 'ota-ona'}</b>, siz <b>${input.studentName || "o'quvchi"}</b>ning darslarini kuzatish uchun tizimga muvaffaqiyatli qo'shildingiz.`
  await sendTelegramMessage({ chatId: input.chatId, text })
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    const parents = await prisma.parent.findMany({
      where: adminId ? { adminId } : undefined,
      orderBy: { createdAt: 'desc' },
      select: PARENT_LEGACY_SELECT,
    })
    const mapped = Array.isArray(parents)
      ? await Promise.all(
          parents.map(async (parent) => {
            const unpacked = unpackParent(parent) as any
            const parentPhone = cleanString(unpacked?.phone) || (isParentMetadataPayload(parent.phone) ? '' : cleanString(parent.phone))
            const metadataChatId = String(unpacked?.telegramChatId || '').trim()
            const linkedChatId = await findTelegramChatIdByPhone(parentPhone)
            const effectiveChatId = metadataChatId || linkedChatId || ''

            if (!metadataChatId && linkedChatId) {
              try {
                const existingMeta = decodeParentMetadata(parent.phone)
                const nextMetadata = {
                  username: unpacked?.username || existingMeta?.username,
                  password: unpacked?.password || existingMeta?.password,
                  studentId: unpacked?.studentId || existingMeta?.studentId,
                  studentIds: unpacked?.studentIds || existingMeta?.studentIds,
                  phone: unpacked?.phone || existingMeta?.phone || (isParentMetadataPayload(parent.phone) ? undefined : parent.phone) || undefined,
                  telegramChatId: linkedChatId,
                }

                await prisma.parent.update({
                  where: { id: parent.id },
                  data: { phone: encodeParentMetadata(nextMetadata) }
                })
              } catch (error) {
                console.warn('Parent telegram metadata sync skipped:', error)
              }
            }

            return {
              ...unpacked,
              telegramChatId: effectiveChatId || undefined,
              telegramConnected: Boolean(effectiveChatId) && String(unpacked?.botStatus || '').toUpperCase() !== 'DISCONNECTED',
              telegramInviteLink: buildTelegramStartLink(parentPhone),
              normalizedPhone: normalizePhoneForDisplay(parentPhone),
            }
          })
        )
      : []
    return NextResponse.json(mapped)
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)

    const fullName = cleanString(body?.fullName)
    const username = cleanString(body?.username)
    const password = cleanString(body?.password)
    const email = cleanString(body?.email)
    const studentIds = parseStudentIds(body?.studentIds, body?.studentId)
    const studentId = getPrimaryStudentId(studentIds)
    const phone = cleanString(body?.phone)

    if (!fullName || !username || !password || !studentId) {
      return NextResponse.json({ error: 'Majburiy maydonlar to‘liq emas' }, { status: 400 })
    }

    if (await hasDuplicateParentUsername({ adminId, username })) {
      return NextResponse.json({ error: 'Bu login (username) allaqachon band' }, { status: 409 })
    }

    if (phone && await hasDuplicateParentPhone({ adminId, phone })) {
      return NextResponse.json({ error: 'Bu telefon raqam boshqa ota-onaga ulangan' }, { status: 409 })
    }

    const metadata = {
      username,
      password,
      studentId,
      studentIds,
      phone: phone || undefined,
      telegramChatId: undefined as string | undefined,
    }

    const autoLinkedChatId = await findTelegramChatIdByPhone(metadata.phone)
    if (autoLinkedChatId) {
      metadata.telegramChatId = autoLinkedChatId
    }

    const hasMetadata = Boolean(metadata.username || metadata.password || metadata.studentId || metadata.studentIds?.length)

    const encodedPhone = hasMetadata ? encodeParentMetadata(metadata) : (phone || null)

    let parent: any
    try {
      parent = await prisma.parent.create({
        data: {
          adminId,
          fullName,
          email: email || null,
          phone: encodedPhone,
        },
        select: PARENT_LEGACY_SELECT,
      })
    } catch (createError: any) {
      if (!isMissingBotStatusColumnError(createError)) {
        throw createError
      }

      const legacyCreated = await createParentLegacy({
        adminId,
        fullName,
        email: email || null,
        phone: encodedPhone,
      })

      if (!legacyCreated) {
        throw createError
      }

      parent = legacyCreated
    }

    if (autoLinkedChatId) {
      const studentName = await resolveStudentName(metadata.studentId)
      try {
        await maybeSendParentWelcome({
          chatId: autoLinkedChatId,
          parentName: fullName || 'ota-ona',
          studentName,
        })
      } catch (telegramError) {
        console.warn('Parent welcome message skipped:', telegramError)
      }
    }

    return NextResponse.json(unpackParent(parent))
  } catch (error) {
    return NextResponse.json({ error: parseApiErrorMessage(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const adminId = getAdminIdFromRequest(request)
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const existing = await prisma.parent.findUnique({ where: { id }, select: PARENT_LEGACY_SELECT })
    if (!existing) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
    }
    if (adminId && existing.adminId !== adminId) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    const nextUsername = body.username !== undefined
      ? cleanString(body.username)
      : cleanString(decodeParentMetadata(existing.phone)?.username)
    const nextPhone = body.phone !== undefined
      ? cleanString(body.phone)
      : cleanString(decodeParentMetadata(existing.phone)?.phone || existing.phone)

    const existingMeta = decodeParentMetadata(existing.phone)
    const nextStudentIds = body.studentIds !== undefined || body.studentId !== undefined
      ? parseStudentIds(body.studentIds, body.studentId)
      : parseStudentIds(existingMeta?.studentIds, existingMeta?.studentId)
    const nextPrimaryStudentId = getPrimaryStudentId(nextStudentIds)

    if (nextUsername && await hasDuplicateParentUsername({ adminId, username: nextUsername, ignoreParentId: id })) {
      return NextResponse.json({ error: 'Bu login (username) allaqachon band' }, { status: 409 })
    }

    if (nextPhone && await hasDuplicateParentPhone({ adminId, phone: nextPhone, ignoreParentId: id })) {
      return NextResponse.json({ error: 'Bu telefon raqam boshqa ota-onaga ulangan' }, { status: 409 })
    }

    const previousNormalizedPhone = normalizePhoneForLinking(existingMeta?.phone || existing.phone)
    const nextMetadata = {
      username: body.username !== undefined ? (body.username || undefined) : existingMeta?.username,
      password: body.password !== undefined ? (body.password || undefined) : existingMeta?.password,
      studentId: nextPrimaryStudentId || undefined,
      studentIds: nextStudentIds,
      phone: body.phone !== undefined ? (body.phone || undefined) : (existingMeta?.phone ?? existing.phone ?? undefined),
      telegramChatId: existingMeta?.telegramChatId,
      botStatus: existingMeta?.botStatus,
      botDisconnectedAt: existingMeta?.botDisconnectedAt,
      botLastCheckedAt: existingMeta?.botLastCheckedAt,
      botLastError: existingMeta?.botLastError,
    }

    const nextNormalizedPhone = normalizePhoneForLinking(nextMetadata.phone)
    const phoneChanged = body.phone !== undefined && previousNormalizedPhone !== nextNormalizedPhone
    if (phoneChanged) {
      nextMetadata.telegramChatId = undefined
    }

    const autoLinkedChatId = await findTelegramChatIdByPhone(nextMetadata.phone)
    if (autoLinkedChatId) {
      nextMetadata.telegramChatId = autoLinkedChatId
      nextMetadata.botStatus = 'CONNECTED'
      nextMetadata.botDisconnectedAt = undefined
      nextMetadata.botLastCheckedAt = new Date().toISOString()
      nextMetadata.botLastError = undefined
    } else if (phoneChanged) {
      nextMetadata.botStatus = 'DISCONNECTED'
      nextMetadata.botDisconnectedAt = new Date().toISOString()
      nextMetadata.botLastCheckedAt = new Date().toISOString()
      nextMetadata.botLastError = 'Telefon raqami o‘zgardi, Telegram qayta ulanmagan'
    }

    const hasMetadata = Boolean(nextMetadata.username || nextMetadata.password || nextMetadata.studentId || nextMetadata.studentIds?.length)

    const data = {
      ...(body.adminId !== undefined && body.adminId !== null && String(body.adminId).trim() !== ''
        ? { adminId: Number(body.adminId) }
        : {}),
      fullName: body.fullName || undefined,
      email: body.email || undefined,
      phone: hasMetadata
        ? encodeParentMetadata(nextMetadata)
        : (body.phone !== undefined ? (body.phone || null) : undefined)
    }

    const parent = await prisma.parent.update({ where: { id }, data, select: PARENT_LEGACY_SELECT })

    const becameConnected = !existingMeta?.telegramChatId && Boolean(nextMetadata.telegramChatId)
    if (becameConnected && nextMetadata.telegramChatId) {
      const studentName = await resolveStudentName(nextMetadata.studentId)
      try {
        await maybeSendParentWelcome({
          chatId: nextMetadata.telegramChatId,
          parentName: body.fullName || existing.fullName,
          studentName,
        })
      } catch (telegramError) {
        console.warn('Parent welcome message skipped:', telegramError)
      }
    }

    return NextResponse.json(unpackParent(parent))
  } catch (error) {
    return NextResponse.json({ error: parseApiErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    const adminId = getAdminIdFromRequest(request)
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    if (adminId) {
      const owned = await prisma.parent.findFirst({ where: { id, adminId }, select: { id: true } })
      if (!owned) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    await prisma.parent.delete({ where: { id }, select: { id: true } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Xatolik' }, { status: 500 })
  }
}
