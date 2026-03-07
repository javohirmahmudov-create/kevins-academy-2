import prisma from '@/lib/prisma'
import { unpackParent } from '@/lib/utils/parentAuth'
import { sendEskizSms } from '@/lib/eskiz'

type SendSmsInput = {
  to: string
  text: string
}

type NotifyParentsSmsInput = {
  adminId?: number | null
  studentId?: number | null
  text: string
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
  const to = normalizePhoneForSms(input.to)
  if (!to) {
    return { ok: false as const, reason: 'invalid_phone' }
  }

  const result = await sendEskizSms(to, input.text)
  if (!result.ok) {
    console.error('SMS send failed:', result)
  }
  return result
}

export async function findLinkedParentPhones(input: { adminId?: number | null; studentId?: number | null }) {
  if (!input.studentId) return [] as string[]

  const collectPhonesFromParents = (parents: any[]) => {
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

  let parents = await prisma.parent.findMany({
    where: input.adminId ? { adminId: input.adminId } : undefined,
    orderBy: { createdAt: 'desc' }
  })

  const scopedPhones = collectPhonesFromParents(parents)
  if (scopedPhones.length > 0 || !input.adminId) {
    return scopedPhones
  }

  parents = await prisma.parent.findMany({ orderBy: { createdAt: 'desc' } })
  return collectPhonesFromParents(parents)
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
