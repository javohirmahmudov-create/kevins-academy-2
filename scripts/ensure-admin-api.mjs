const base = 'https://kevins-academy.com'

async function run() {
  const listRes = await fetch(`${base}/api/admins`)
  const admins = await listRes.json()
  if (!Array.isArray(admins)) {
    throw new Error('admins list error')
  }

  const found = admins.find((admin) => String(admin?.username || '').toLowerCase() === 'admin')

  if (found) {
    const updateRes = await fetch(`${base}/api/admins`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: found.id,
        username: 'admin',
        password: '123',
        fullName: found.fullName || 'Admin',
        contactPhone: found.contactPhone || '',
        telegramUsername: found.telegramUsername || '',
        notifyTelegram: found.notifyTelegram ?? true,
        notifySms: found.notifySms ?? true,
      }),
    })
    const updateBody = await updateRes.text()
    console.log('updated', updateRes.status, updateBody)
  } else {
    const createRes = await fetch(`${base}/api/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: '123',
        fullName: 'Admin',
      }),
    })
    const createBody = await createRes.text()
    console.log('created', createRes.status, createBody)
  }

  const verifyRes = await fetch(`${base}/api/admins`)
  const verify = await verifyRes.json()
  const row = Array.isArray(verify)
    ? verify.find((admin) => String(admin?.username || '').toLowerCase() === 'admin')
    : null

  if (!row) {
    throw new Error('admin user not found after create/update')
  }

  console.log('verify', JSON.stringify({ id: row.id, username: row.username, fullName: row.fullName }))
}

run().catch((error) => {
  console.error('failed:', error.message)
  process.exit(1)
})
