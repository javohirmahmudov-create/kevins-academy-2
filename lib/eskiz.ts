type EskizTokenCache = {
  token: string
  expiresAt: number
}

const TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000
const ESKIZ_AUTH_URL = 'https://notify.eskiz.uz/api/auth/login'
const ESKIZ_SEND_SMS_URL = 'https://notify.eskiz.uz/api/message/sms/send'

let tokenCache: EskizTokenCache | null = null

function normalizePhone(phone?: string | null) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9) digits = `998${digits}`
  if (digits.length === 10 && digits.startsWith('0')) digits = `998${digits.slice(1)}`
  if (digits.length > 12) digits = digits.slice(-12)

  if (!digits.startsWith('998') || digits.length !== 12) return ''
  return digits
}

function extractToken(payload: any) {
  return String(
    payload?.data?.token
    || payload?.token
    || payload?.data?.access_token
    || payload?.access_token
    || ''
  ).trim()
}

export async function getEskizToken(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && tokenCache?.token && tokenCache.expiresAt > now) {
    return tokenCache.token
  }

  const staticToken = String(process.env.ESKIZ_TOKEN || '').trim()
  if (staticToken && !forceRefresh) {
    tokenCache = {
      token: staticToken,
      expiresAt: now + TOKEN_TTL_MS,
    }
    return staticToken
  }

  const email = String(process.env.ESKIZ_EMAIL || '').trim()
  const password = String(process.env.ESKIZ_PASSWORD || '').trim()
  if (!email || !password) {
    throw new Error('ESKIZ_EMAIL/ESKIZ_PASSWORD missing')
  }

  const body = new URLSearchParams({ email, password })
  const response = await fetch(ESKIZ_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })

  const raw = await response.text()
  let parsed: any = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }

  if (!response.ok) {
    throw new Error(`Eskiz auth failed (${response.status}): ${raw}`)
  }

  const token = extractToken(parsed)
  if (!token) {
    throw new Error('Eskiz auth response missing token')
  }

  tokenCache = {
    token,
    expiresAt: now + TOKEN_TTL_MS,
  }

  return token
}

export async function sendEskizSms(phone: string, message: string) {
  const normalized = normalizePhone(phone)
  if (!normalized) {
    return { ok: false as const, reason: 'invalid_phone' }
  }

  let token = ''
  try {
    token = await getEskizToken()
  } catch (error) {
    return { ok: false as const, reason: 'missing_sms_config', error: error instanceof Error ? error.message : String(error) }
  }

  const from = String(process.env.ESKIZ_FROM || process.env.SMS_FROM || '4546').trim()
  const body = new URLSearchParams({
    mobile_phone: normalized,
    message: String(message || '').trim(),
    from,
  })

  const executeSend = async (authToken: string) => {
    const response = await fetch(ESKIZ_SEND_SMS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    })

    const raw = await response.text()
    let parsed: any = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }

    return { response, raw, parsed }
  }

  try {
    let sent = await executeSend(token)

    const unauthorized = sent.response.status === 401 || sent.response.status === 403
    if (!sent.response.ok && unauthorized) {
      const refreshedToken = await getEskizToken(true)
      sent = await executeSend(refreshedToken)
    }

    if (!sent.response.ok) {
      return {
        ok: false as const,
        reason: 'send_failed',
        status: sent.response.status,
        error: sent.raw,
      }
    }

    return {
      ok: true as const,
      status: sent.response.status,
      data: sent.parsed,
    }
  } catch (error) {
    return {
      ok: false as const,
      reason: 'send_error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function sendSms(phone: string, message: string) {
  return sendEskizSms(phone, message)
}
