import { NextResponse } from 'next/server'

function fallbackAdvice(input: {
  studentName: string
  weakestSection: string
  weakestPart?: string
}) {
  const section = input.weakestSection || 'eng zaif ko‘nikma'
  const part = input.weakestPart ? ` (${input.weakestPart})` : ''
  return `${input.studentName}, bu hafta ${section}${part} bo‘yicha har kuni 20 daqiqa focused practice qil. 10 ta savollik mini-test bilan kunni yakunla.`
}

async function askGeminiWithFallback(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
  if (!apiKey) return ''

  const configuredModels = (process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-2.0-flash-lite,gemini-1.5-flash-latest,gemini-1.5-flash')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const models = configuredModels.length
    ? configuredModels
    : ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash']

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 12000)
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000

  for (const model of models) {
    const urls = [
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
    ]

    for (const url of urls) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), safeTimeout)

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(url.includes('?key=') ? {} : { 'x-goog-api-key': apiKey }),
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 280,
            },
          }),
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) continue

        const data = await response.json()
        const text = (data?.candidates || [])
          .flatMap((candidate: any) => candidate?.content?.parts || [])
          .map((part: any) => part?.text)
          .filter(Boolean)
          .join('\n')
          .trim()

        if (text) return text
      } catch {
        // try next url/model
      }
    }
  }

  return ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const studentName = String(body?.studentName || 'O‘quvchi').trim()
    const level = String(body?.level || 'beginner').trim()
    const averageScore = Number(body?.averageScore || 0)
    const weakestSection = String(body?.weakestSection || '').trim()
    const weakestPart = String(body?.weakestPart || '').trim()
    const trend = Array.isArray(body?.trend)
      ? body.trend.slice(-5).map((item: any) => Number(item?.score || 0)).filter((value: number) => Number.isFinite(value))
      : []
    const sectionSnapshot = Array.isArray(body?.sections)
      ? body.sections
          .slice(0, 8)
          .map((item: any) => `${String(item?.label || item?.key || '').trim()}: ${Number(item?.percent || 0).toFixed(1)}%`)
          .join('; ')
      : ''

    const prompt = [
      'Sen Kevin\'s Academy student coach AI\'sisan.',
      'Faqat o\'zbek tilida yoz.',
      'Javob 2-3 gap bo\'lsin, motivatsion va juda amaliy bo\'lsin.',
      'O\'quvchi nomini boshida ishlat.',
      'Agar weakest section berilgan bo\'lsa, aynan shuni nishonga ol.',
      'Agar weakest part berilgan bo\'lsa, uni ham qo\'sh.',
      '',
      `Student: ${studentName}`,
      `Level: ${level}`,
      `Average score: ${averageScore}`,
      `Weakest section: ${weakestSection || 'unknown'}`,
      `Weakest part: ${weakestPart || 'unknown'}`,
      `Last 5 trend: ${trend.join(', ') || 'n/a'}`,
      `Section snapshot: ${sectionSnapshot || 'n/a'}`,
    ].join('\n')

    const aiText = await askGeminiWithFallback(prompt)
    const advice = aiText || fallbackAdvice({ studentName, weakestSection, weakestPart })

    return NextResponse.json({ ok: true, advice, source: aiText ? 'gemini' : 'fallback' })
  } catch {
    return NextResponse.json({ ok: false, advice: '', source: 'error' }, { status: 500 })
  }
}
