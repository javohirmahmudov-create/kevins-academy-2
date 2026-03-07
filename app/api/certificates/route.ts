import { NextResponse } from 'next/server'
import { del, put } from '@vercel/blob'
import prisma from '@/lib/prisma'
import { getAdminIdFromRequest } from '@/lib/utils/adminScope'
import { notifyParentsByStudentId, queueTelegramTask } from '@/lib/telegram'

const CERTIFICATE_GROUP = '__certificate__'
const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024
const ALLOWED_CERTIFICATE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png'])
const ALLOWED_CERTIFICATE_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  }
  return token
}

function normalizeLevel(raw?: string | null) {
  const value = String(raw || '').trim().toLowerCase()
  if (value.includes('advanced')) return 'advanced'
  if (value.includes('intermediate')) return 'intermediate'
  return 'other'
}

function getFileExtension(fileName?: string | null) {
  const lower = String(fileName || '').trim().toLowerCase()
  const parts = lower.split('.')
  return parts.length > 1 ? String(parts[parts.length - 1] || '') : ''
}

function normalizeCertificateExtension(input: { fileName?: string | null; mimeType?: string | null }) {
  const fromName = getFileExtension(input.fileName)
  if (ALLOWED_CERTIFICATE_EXTENSIONS.has(fromName)) return fromName

  const mime = String(input.mimeType || '').trim().toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  return ''
}

function isAllowedCertificateFile(input: { fileName?: string | null; mimeType?: string | null }) {
  const ext = normalizeCertificateExtension(input)
  if (!ext) return false

  const mime = String(input.mimeType || '').trim().toLowerCase()
  if (!mime) return true
  return ALLOWED_CERTIFICATE_MIME_TYPES.has(mime)
}

function sanitizeForCertificateName(raw?: string | null) {
  return String(raw || '')
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

function formatCertificateDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hour = String(value.getHours()).padStart(2, '0')
  const minute = String(value.getMinutes()).padStart(2, '0')
  const second = String(value.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hour}${minute}${second}`
}

function buildCertificateFileName(input: { studentName: string; extension: string; now: Date }) {
  const normalizedName = sanitizeForCertificateName(input.studentName) || 'Oquvchi'
  const datePart = formatCertificateDate(input.now)
  return `${normalizedName}_CEFR_${datePart}.${input.extension}`
}

function safeTelegramText(input?: string | null, maxLength = 700) {
  const value = String(input || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function parseCertificateTitle(title: string) {
  const [prefix, studentId, ...nameParts] = String(title || '').split(':')
  if (prefix !== 'CERTIFICATE' || !studentId) {
    return { studentId: '', fileName: title }
  }
  return {
    studentId,
    fileName: nameParts.join(':') || 'certificate',
  }
}

export async function GET(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope is required' }, { status: 400 })
    }

    const url = new URL(request.url)
    const studentId = String(url.searchParams.get('studentId') || '').trim()

    const certificates = await prisma.material.findMany({
      where: {
        adminId,
        group: CERTIFICATE_GROUP,
        ...(studentId ? { title: { startsWith: `CERTIFICATE:${studentId}:` } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      certificates.map((item) => {
        const parsed = parseCertificateTitle(item.title)
        return {
          id: item.id,
          studentId: parsed.studentId,
          fileName: parsed.fileName,
          fileUrl: item.fileUrl,
          fileType: item.fileType,
          uploadedAt: item.uploadedAt || item.createdAt,
        }
      }),
    )
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope is required' }, { status: 400 })
    }

    const form = await request.formData()
    const uploaded = form.get('file')
    const studentIdRaw = String(form.get('studentId') || '').trim()
    const studentId = Number(studentIdRaw)
    const scoreType = String(form.get('scoreType') || '').trim().toLowerCase()
    const criteriaSummary = safeTelegramText(String(form.get('criteriaSummary') || ''), 900)
    const overallPercentRaw = Number(form.get('overallPercent') || 0)
    const overallPercent = Number.isFinite(overallPercentRaw) ? Math.max(0, Math.min(100, overallPercentRaw)) : 0

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: 'File topilmadi' }, { status: 400 })
    }
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'studentId majburiy' }, { status: 400 })
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        adminId,
      },
      select: {
        id: true,
        fullName: true,
        group: true,
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'O‘quvchi topilmadi' }, { status: 404 })
    }

    const linkedGroup = student.group
      ? await prisma.group.findFirst({
          where: {
            name: String(student.group),
          },
          select: { level: true },
        })
      : null

    const level = normalizeLevel(String(linkedGroup?.level || form.get('level') || ''))
    if (!['intermediate', 'advanced'].includes(level)) {
      return NextResponse.json({ error: 'Sertifikat faqat intermediate/advanced uchun' }, { status: 403 })
    }

    if (!isAllowedCertificateFile({ fileName: uploaded.name, mimeType: uploaded.type })) {
      return NextResponse.json({ error: 'Faqat .pdf, .jpg, .jpeg yoki .png fayl qabul qilinadi' }, { status: 400 })
    }

    if (uploaded.size > MAX_CERTIFICATE_BYTES) {
      return NextResponse.json({ error: 'Fayl 10MB dan kichik bo‘lishi kerak' }, { status: 400 })
    }

    const extension = normalizeCertificateExtension({ fileName: uploaded.name, mimeType: uploaded.type })
    if (!extension) {
      return NextResponse.json({ error: 'Fayl turi aniqlanmadi' }, { status: 400 })
    }

    const now = new Date()
    const generatedFileName = buildCertificateFileName({
      studentName: student.fullName,
      extension,
      now,
    })

    const token = getBlobToken()
    const blob = await put(`certificates/${adminId}/${student.id}/${Date.now()}-${generatedFileName}`, uploaded, {
      access: 'public',
      token,
    })

    const record = await prisma.material.create({
      data: {
        adminId,
        title: `CERTIFICATE:${student.id}:${generatedFileName}`,
        group: CERTIFICATE_GROUP,
        fileUrl: blob.url,
        fileType: uploaded.type || (extension === 'pdf' ? 'application/pdf' : `image/${extension}`),
        uploadedBy: student.fullName || `student-${student.id}`,
        uploadedAt: now,
        content: JSON.stringify({
          studentId: student.id,
          studentName: student.fullName,
          level,
          originalName: uploaded.name,
          generatedFileName,
          uploadedAt: now.toISOString(),
          scoreType,
          overallPercent,
          criteriaSummary,
        }),
      },
    })

    queueTelegramTask(async () => {
      const scoreTypeLabel = scoreType === 'mock' ? 'MOCK EXAM' : scoreType === 'weekly' ? 'WEEKLY' : 'BAHOLASH'
      const lines = [
        'Tabriklaymiz! Sertifikatingiz qabul qilindi va tekshirish uchun adminga yuborildi.',
        `Format: ${scoreTypeLabel}`,
        overallPercent > 0 ? `Umumiy natija: ${overallPercent.toFixed(1)}%` : '',
        criteriaSummary ? `Baholash mezoni: ${criteriaSummary}` : '',
      ].filter(Boolean)

      await notifyParentsByStudentId({
        adminId,
        studentId: student.id,
        text: lines.join('\n'),
      })
    })

    return NextResponse.json({
      id: record.id,
      studentId: String(student.id),
      fileName: generatedFileName,
      fileUrl: record.fileUrl,
      fileType: record.fileType,
      uploadedAt: record.uploadedAt || record.createdAt,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const adminId = getAdminIdFromRequest(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Admin scope is required' }, { status: 400 })
    }

    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    const studentId = String(url.searchParams.get('studentId') || '').trim()
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id noto‘g‘ri' }, { status: 400 })
    }

    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing || existing.adminId !== adminId || existing.group !== CERTIFICATE_GROUP) {
      return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })
    }

    if (studentId && !existing.title.startsWith(`CERTIFICATE:${studentId}:`)) {
      return NextResponse.json({ error: 'Ruxsat yo‘q' }, { status: 403 })
    }

    if (existing.fileUrl?.startsWith('http')) {
      try {
        const token = getBlobToken()
        await del(existing.fileUrl, { token })
      } catch {
        // no-op
      }
    }

    await prisma.material.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Xatolik' }, { status: 500 })
  }
}
