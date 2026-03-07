import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

const envPath = process.argv[2] || '.env.local'
dotenv.config({ path: envPath })

function decodeMeta(phone) {
  const prefix = '__KA_PARENT__:'
  if (!phone || typeof phone !== 'string' || !phone.startsWith(prefix)) return null
  try {
    const raw = phone.slice(prefix.length)
    const json = Buffer.from(raw, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

const prisma = new PrismaClient()

try {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  if (!token) {
    console.log(JSON.stringify({ ok: false, reason: 'missing TELEGRAM_BOT_TOKEN' }, null, 2))
    process.exit(0)
  }

  const rows = await prisma.$queryRawUnsafe('SELECT "id", "fullName", "phone" FROM "Parent" ORDER BY "createdAt" DESC LIMIT 300')

  let target = null
  for (const row of rows) {
    const meta = decodeMeta(row.phone)
    const chatId = meta?.telegramChatId ? String(meta.telegramChatId).trim() : ''
    if (!chatId) continue
    target = {
      id: row.id,
      fullName: row.fullName,
      studentId: meta?.studentId || null,
      chatId,
    }
    break
  }

  if (!target) {
    console.log(JSON.stringify({ ok: false, reason: 'no parent with telegramChatId found in local db' }, null, 2))
    process.exit(0)
  }

  const text = `🧪 Live test\nParent: ${target.fullName}\nVaqt: ${new Date().toISOString()}`
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: target.chatId, text }),
  })

  const responseText = await res.text()
  console.log(
    JSON.stringify(
      {
        ok: res.ok,
        status: res.status,
        parentId: target.id,
        parentName: target.fullName,
        studentId: target.studentId,
        chatId: target.chatId,
        response: responseText.slice(0, 500),
      },
      null,
      2
    )
  )
} catch (error) {
  console.error(error)
} finally {
  await prisma.$disconnect()
}
