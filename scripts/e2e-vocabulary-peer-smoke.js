#!/usr/bin/env node

const baseUrl = String(process.env.BASE_URL || 'https://kevins-academy.com').replace(/\/$/, '')
const groupName = String(process.env.PEER_GROUP || 'IELTS')

async function fetchJson(path) {
  const url = `${baseUrl}${path}`
  const response = await fetch(url)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  return { url, status: response.status, ok: response.ok, body }
}

async function fetchStatus(path) {
  const url = `${baseUrl}${path}`
  const response = await fetch(url, { redirect: 'manual' })
  return {
    url,
    status: response.status,
    ok: response.ok,
    location: response.headers.get('location') || null,
  }
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function run() {
  const encodedGroup = encodeURIComponent(groupName)

  const checks = []

  const pairs = await fetchJson(`/api/vocabulary/peer/pairs?group=${encodedGroup}`)
  assertCondition(pairs.ok, `peer/pairs failed with status ${pairs.status}`)
  const students = Array.isArray(pairs.body?.students) ? pairs.body.students : []
  checks.push({
    check: 'peer pairs endpoint',
    ok: true,
    status: pairs.status,
    students: students.length,
    url: pairs.url,
  })

  const page = await fetchStatus('/student/vocabulary?tab=peer')
  assertCondition(page.status >= 200 && page.status < 400, `peer page failed with status ${page.status}`)
  checks.push({
    check: 'peer page route',
    ok: true,
    status: page.status,
    location: page.location,
    url: page.url,
  })

  console.log(JSON.stringify({ ok: true, baseUrl, group: groupName, checks }, null, 2))
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, group: groupName, error: String(error?.message || error) }, null, 2))
  process.exit(1)
})
