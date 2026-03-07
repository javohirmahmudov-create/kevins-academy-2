import { NextResponse } from 'next/server'

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>
  }
}

function extractWords(rawText: string): string[] {
  const cleaned = String(rawText || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[\r\n]+/g, ' ')

  const matches = cleaned.match(/[A-Za-z][A-Za-z'\-]{1,24}/g) || []
  const unique: string[] = []
  const seen = new Set<string>()

  for (const token of matches) {
    const normalized = token.toLowerCase().replace(/^'+|'+$/g, '')
    if (!normalized || normalized.length < 2) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(normalized)
    if (unique.length >= 200) break
  }

  return unique
}

async function callGeminiForWords(args: {
  apiKey: string
  mimeType: string
  base64Data: string
}): Promise<string> {
  const models = (process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-1.5-flash-latest,gemini-1.5-flash')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const modelList = models.length > 0 ? models : ['gemini-2.0-flash', 'gemini-1.5-flash-latest']
  const urlsFor = (model: string, apiKey: string) => [
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
  ]

  const prompt = [
    'Extract only English vocabulary words from this file.',
    'Return plain text words separated by commas or new lines.',
    'No explanations, no numbering, no extra symbols.',
    'Ignore phonetics and grammar labels.'
  ].join(' ')

  for (const model of modelList) {
    for (const url of urlsFor(model, args.apiKey)) {
      const parts: GeminiPart[] = [
        { text: prompt },
        {
          inlineData: {
            mimeType: args.mimeType,
            data: args.base64Data,
          },
        },
      ]

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(url.includes('?key=') ? {} : { 'x-goog-api-key': args.apiKey }),
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1500,
            },
          }),
        })

        const raw = await response.text()
        let json: { candidates?: GeminiCandidate[]; error?: unknown } | null = null
        try {
          json = JSON.parse(raw)
        } catch {
          json = null
        }

        if (!response.ok) continue

        const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ').trim() || ''
        if (text) return text
      } catch {
        continue
      }
    }
  }

  throw new Error('Gemini so‘rov muvaffaqiyatsiz tugadi')
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const uploaded = formData.get('file')

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: 'Fayl topilmadi' }, { status: 400 })
    }

    const mimeType = String(uploaded.type || '').toLowerCase()
    const isImage = mimeType.startsWith('image/')
    const isPdf = mimeType === 'application/pdf' || uploaded.name.toLowerCase().endsWith('.pdf')

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: 'Faqat PDF yoki image fayl qabul qilinadi' }, { status: 400 })
    }

    const maxBytes = 12 * 1024 * 1024
    if (uploaded.size > maxBytes) {
      return NextResponse.json({ error: 'Fayl hajmi 12MB dan katta bo‘lmasin' }, { status: 400 })
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ''

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY topilmadi' }, { status: 500 })
    }

    const buffer = Buffer.from(await uploaded.arrayBuffer())
    const base64Data = buffer.toString('base64')
    const text = await callGeminiForWords({
      apiKey,
      mimeType: isPdf ? 'application/pdf' : mimeType,
      base64Data,
    })

    const words = extractWords(text)

    return NextResponse.json({
      words: words.map((word) => ({ word })),
      count: words.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Word scan failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
