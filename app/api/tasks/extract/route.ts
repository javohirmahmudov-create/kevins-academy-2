import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function normalizeText(input: string, maxLength = 8000) {
  return String(input || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
}

function inferKind(fileType?: string, fileName?: string) {
  const type = String(fileType || '').toLowerCase()
  const ext = String(fileName || '').toLowerCase().split('.').pop() || ''

  if (type.includes('pdf') || ext === 'pdf') return 'pdf'
  if (type.includes('html') || ext === 'html' || ext === 'htm') return 'html'
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image'
  return 'file'
}

function htmlToText(html: string) {
  return normalizeText(
    String(html || '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/p\s*>/gi, '\n\n')
      .replace(/<\s*\/div\s*>/gi, '\n')
      .replace(/<\s*li\b[^>]*>/gi, '\n• ')
      .replace(/<\s*\/li\s*>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
  )
}

async function extractWithGemini(input: { mimeType: string; buffer: Buffer }) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  if (!apiKey) return ''

  const models = (process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-1.5-flash-latest')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const modelList = models.length > 0 ? models : ['gemini-2.0-flash']
  const base64Data = input.buffer.toString('base64')

  for (const model of modelList) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract readable educational text from this file. Keep original language lines and return plain text only.' },
              { inlineData: { mimeType: input.mimeType, data: base64Data } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      })

      if (!response.ok) continue
      const data = await response.json().catch(() => null)
      const text = String(
        data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => part?.text || '')
          .join('\n') || ''
      ).trim()

      if (text) return normalizeText(text)
    } catch {
      continue
    }
  }

  return ''
}

async function parsePdf(buffer: Buffer) {
  try {
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = (pdfParseModule as any).default || pdfParseModule
    const parsed = await pdfParse(buffer)
    return normalizeText(String(parsed?.text || ''))
  } catch {
    return ''
  }
}

async function parseImage(buffer: Buffer) {
  try {
    const tesseract = await import('tesseract.js')
    const worker = await tesseract.createWorker('eng')
    try {
      const result = await worker.recognize(buffer)
      return normalizeText(String(result?.data?.text || ''))
    } finally {
      await worker.terminate()
    }
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fileUrl = String(body?.fileUrl || '').trim()
    const fileType = String(body?.fileType || '').trim()
    const fileName = String(body?.fileName || '').trim()

    if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
      return NextResponse.json({ error: 'fileUrl required' }, { status: 400 })
    }

    const response = await fetch(fileUrl)
    if (!response.ok) {
      return NextResponse.json({ error: 'File fetch failed' }, { status: 400 })
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const kind = inferKind(fileType || response.headers.get('content-type') || '', fileName)

    let extractedText = ''
    if (kind === 'pdf') {
      extractedText = await parsePdf(buffer)
    } else if (kind === 'html') {
      extractedText = htmlToText(buffer.toString('utf-8'))
    } else if (kind === 'image') {
      extractedText = await parseImage(buffer)
    }

    if (!extractedText && (kind === 'pdf' || kind === 'image')) {
      extractedText = await extractWithGemini({
        mimeType: kind === 'pdf' ? 'application/pdf' : (fileType || response.headers.get('content-type') || 'image/png'),
        buffer,
      })
    }

    return NextResponse.json({
      ok: true,
      kind,
      extractedText,
      hasText: Boolean(extractedText),
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'extract_failed') }, { status: 500 })
  }
}
