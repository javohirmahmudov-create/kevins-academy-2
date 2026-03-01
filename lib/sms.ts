import prisma from '@/lib/prisma'
import { unpackParent } from '@/lib/utils/parentAuth'

type SendSmsInput = {
  to: string
  text: string
}

type NotifyParentsSmsInput = {
  adminId?: number | null
  studentId?: number | null
  text: string
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
  const authToken = process.env.TWILIO_AUTH_TOKEN || ''
  const from = process.env.TWILIO_FROM_NUMBER || ''

  if (!accountSid || !authToken || !from) return null
  return { accountSid, authToken, from }
}

function normalizePhoneForSms(phone?: string | null) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.length === 9) digits = `998${digits}`
  if (digits.length === 10 && digits.startsWith('0')) digits = `998${digits.slice(1)}`

  if (digits.length !== 12 || !digits.startsWith('998')) return ''
  return `+${digits}`
}

export async function sendSms(input: SendSmsInput) {
  const config = getTwilioConfig()
  if (!config) {
    return { ok: false as const, reason: 'missing_sms_config' }
  }

  const to = normalizePhoneForSms(input.to)
  if (!to) {
    return { ok: false as const, reason: 'invalid_phone' }
  }

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')
    const body = new URLSearchParams({
      To: to,
      From: config.from,
      Body: input.text,
    })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    if (!response.ok) {
      const raw = await response.text()
      console.error('SMS send failed:', raw)
      return { ok: false as const, reason: 'send_failed' }
    }

    return { ok: true as const }
  } catch (error) {
    console.error('SMS send error:', error)
    return { ok: false as const, reason: 'send_error' }
  }
}

export async function findLinkedParentPhones(input: { adminId?: number | null; studentId?: number | null }) {
  if (!input.studentId) return [] as string[]

  const parents = await prisma.parent.findMany({
    where: input.adminId ? { adminId: input.adminId } : undefined,
    orderBy: { createdAt: 'desc' }
  })

  const phones = new Set<string>()

  for (const parent of parents) {
    const unpacked = unpackParent(parent) as any
    const linkedStudentId = unpacked?.studentId ? Number(unpacked.studentId) : null
    const phone = normalizePhoneForSms(unpacked?.phone || parent.phone)
    if (linkedStudentId === input.studentId && phone) {
      phones.add(phone)
    }
  }

  return Array.from(phones)
}

export async function notifyParentsByStudentIdSms(input: NotifyParentsSmsInput) {
  try {
    const phones = await findLinkedParentPhones({ adminId: input.adminId, studentId: input.studentId })
    if (!phones.length) return

    for (const phone of phones) {
      await sendSms({ to: phone, text: input.text })
    }
  } catch (error) {
    console.error('Notify parents by SMS failed:', error)
  }
}

export function queueSmsTask(task: () => Promise<void>) {
  setTimeout(() => {
    task().catch((error) => {
      console.error('Queued SMS task failed:', error)
    })
  }, 0)
}
