const BASE = 'https://kevins-academy.com'

const rows = [
  { studentName: 'Avazbek Mashrabov', studentPhone: '+99890584590', studentUsername: 'u01avazb', studentPassword: 'ukv#001', parentName: "Qo'ziyeva Feruzaxon", parentPhone: '+99890584590', parentUsername: 'p01qoziy', parentPassword: 'ota#001' },
  { studentName: 'Intizor Muqimova', studentPhone: '+998 97 181 87 75', studentUsername: 'u02ixtir', studentPassword: 'ukv#002', parentName: 'Xalilova Nozima', parentPhone: '+998 97 181 87 75', parentUsername: 'p02xalil', parentPassword: 'ota#002' },
  { studentName: 'Dilnura Muqimova', studentPhone: '+998 88 151 01 99', studentUsername: 'u03dilnu', studentPassword: 'ukv#003', parentName: 'Xalilova Dilnoza', parentPhone: '+998 88 151 01 99', parentUsername: 'p03xalil', parentPassword: 'ota#003' },
  { studentName: "Og'abek Shokirjonov", studentPhone: '+998 44 122 79 35', studentUsername: 'u04ogabe', studentPassword: 'ukv#004', parentName: 'Xoltoyev Oybek', parentPhone: '+998 44 122 79 35', parentUsername: 'p04xolto', parentPassword: 'ota#004' },
  { studentName: "Farrux Xoldorxo'jayeva", studentPhone: '+998 91 445 00 29', studentUsername: 'u05farru', studentPassword: 'ukv#005', parentName: 'Xoltoyev Shavkat', parentPhone: '+998 91 445 00 29', parentUsername: 'p05xolto', parentPassword: 'ota#005' },
  { studentName: 'Madina Alijonova', studentPhone: '+998 91 115 03 89', studentUsername: 'u06madin', studentPassword: 'ukv#006', parentName: 'Matkarimova Gulnoza', parentPhone: '+998 91 115 03 89', parentUsername: 'p06matka', parentPassword: 'ota#006' },
  { studentName: "Ro'zmatjonov Sardorbek", studentPhone: '+998 91 674 19 91', studentUsername: 'u07rozma', studentPassword: 'ukv#007', parentName: 'Arentayev Ziyodjon', parentPhone: '+998 91 674 19 91', parentUsername: 'p07arent', parentPassword: 'ota#007' },
  { studentName: 'Sheraliyev Shohruz', studentPhone: '+998 97 661 06 99', studentUsername: 'u08shera', studentPassword: 'ukv#008', parentName: 'Sodiqov Bahodir', parentPhone: '+998 97 661 06 99', parentUsername: 'p08sodiq', parentPassword: 'ota#008' },
  { studentName: 'Iftixorov Imronbek', studentPhone: '+998 90 537 36 42', studentUsername: 'u09ifix', studentPassword: 'ukv#009', parentName: 'Yaqubova Zeboxon', parentPhone: '+998 90 537 36 42', parentUsername: 'p09yaqub', parentPassword: 'ota#009' },
  { studentName: 'Xolmirzayev Bekzod', studentPhone: '+998 99 371 14 64', studentUsername: 'u10xolmi', studentPassword: 'ukv#010', parentName: 'Nishonov Botir', parentPhone: '+998 99 371 14 64', parentUsername: 'p10nisho', parentPassword: 'ota#010' },
  { studentName: 'Xabiljonov Tolibjon', studentPhone: '+998 91 681 08 61', studentUsername: 'u11xabil', studentPassword: 'ukv#011', parentName: 'Siddiqov Xaliljon', parentPhone: '+998 91 681 08 61', parentUsername: 'p11siddi', parentPassword: 'ota#011' },
  { studentName: 'Qodirova Madina', studentPhone: '+998 91 108 08 97', studentUsername: 'u12bodir', studentPassword: 'ukv#012', parentName: 'Saydahmedova Shohidaxon', parentPhone: '+998 91 108 08 97', parentUsername: 'p12sayda', parentPassword: 'ota#012' },
  { studentName: 'Muydinov Alisher', studentPhone: '+998 90 776 84 80', studentUsername: 'u13mayde', studentPassword: 'ukv#013', parentName: 'Saydahmedov Qodirjon', parentPhone: '+998 90 776 84 80', parentUsername: 'p13sayda', parentPassword: 'ota#013' },
  { studentName: 'Akbarov Sardor', studentPhone: '+998 91 106 04 99', studentUsername: 'u14akbar', studentPassword: 'ukv#014', parentName: 'Akbarova Saida', parentPhone: '+998 91 106 04 99', parentUsername: 'p14akbar', parentPassword: 'ota#014' },
  { studentName: "Davlatxo'jayeva Mohitabonu", studentPhone: '+998 94 327 50 10', studentUsername: 'u15davla', studentPassword: 'ukv#015', parentName: 'Yusupova Rahimaxon', parentPhone: '+998 94 327 50 10', parentUsername: 'p15yusup', parentPassword: 'ota#015' },
  { studentName: 'Shuxratov Amriddin', studentPhone: '+998 90 163 30 63', studentUsername: 'u16shuxr', studentPassword: 'ukv#016', parentName: 'Yulduzov Shuxrat', parentPhone: '+998 90 163 30 63', parentUsername: 'p16yuldu', parentPassword: 'ota#016' },
  { studentName: 'Tolipov Xushnudbek', studentPhone: '+998 90 534 43 94', studentUsername: 'u17tolip', studentPassword: 'ukv#017', parentName: 'Erkinjon', parentPhone: '+998 90 534 43 94', parentUsername: 'p17erkin', parentPassword: 'ota#017' },
  { studentName: "G'ayratov Izzatillo", studentPhone: '+998 80 303 05 80', studentUsername: 'u18zayna', studentPassword: 'ukv#018', parentName: 'Yorqinova Tursinoy', parentPhone: '+998 80 303 05 80', parentUsername: 'p18yorqi', parentPassword: 'ota#018' },
  { studentName: 'Erkinjonov Hasanboy', studentPhone: '+998 91 158 69 49', studentUsername: 'u19erkin', studentPassword: 'ukv#019', parentName: 'Yigitaliyeva Zarina', parentPhone: '+998 91 158 69 49', parentUsername: 'p19yigit', parentPassword: 'ota#019' },
  { studentName: "O'njonova Parizoda", studentPhone: '+998 91 230 89 69', studentUsername: 'u20njon', studentPassword: 'ukv#020', parentName: 'Abduvohidova Sarvinoy', parentPhone: '+998 91 230 89 69', parentUsername: 'p20abduv', parentPassword: 'ota#020' },
  { studentName: 'Olimjonova Parizoda', studentPhone: '+998 81 086 60 88', studentUsername: 'u21yoray', studentPassword: 'ukv#021', parentName: 'Abduvohidova Sarvinoy', parentPhone: '+998 81 086 60 88', parentUsername: 'p21abduv', parentPassword: 'ota#021' },
  { studentName: 'Namonjonov Nurmuhammad', studentPhone: '+998 90 838 51 55', studentUsername: 'u22namon', studentPassword: 'ukv#022', parentName: '', parentPhone: '', parentUsername: '', parentPassword: '' },
  { studentName: 'Qobiljonova Hadichaxon', studentPhone: '+998 91 396 90 92', studentUsername: 'u23qobil', studentPassword: 'ukv#023', parentName: 'Iskandarova Iqboloy', parentPhone: '+998 91 396 90 92', parentUsername: 'p23iskan', parentPassword: 'ota#023' },
  { studentName: "Ro'zmatjonov Sardorbek", studentPhone: '+998 33 438 91 91', studentUsername: 'u24rosma', studentPassword: 'ukv#024', parentName: 'Arentayeva Tursunoy', parentPhone: '+998 33 438 91 91', parentUsername: 'p24arent', parentPassword: 'ota#024' },
  { studentName: "Jo'rayev Ahliyorbek", studentPhone: '+998 88 848 02 11', studentUsername: 'u25ahli', studentPassword: 'ukv#025', parentName: 'Mamatova Zarifa', parentPhone: '+998 88 848 02 11', parentUsername: 'p25mamat', parentPassword: 'ota#025' },
]

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data }
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('998')) return digits
  if (digits.length === 9) return `998${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `998${digits.slice(1)}`
  return digits
}

async function run() {
  const auth = await req('/api/auth/admin', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })

  if (!auth.ok || !auth.data?.id) {
    throw new Error(`Admin auth failed: ${auth.status} ${JSON.stringify(auth.data)}`)
  }

  const adminId = Number(auth.data.id)
  const headers = { 'x-admin-id': String(adminId) }
  const groupName = 'ELEMENTARY-LITSEY'
  const groupLevel = 'Elementary'

  const groupsRes = await req('/api/groups', { headers })
  if (!groupsRes.ok) throw new Error(`groups GET failed: ${groupsRes.status}`)
  const groups = Array.isArray(groupsRes.data) ? groupsRes.data : []
  const existingGroup = groups.find((group) => String(group?.name || '').trim().toLowerCase() === groupName.toLowerCase())

  if (!existingGroup) {
    const created = await req('/api/groups', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: groupName, level: groupLevel }),
    })
    if (!created.ok) throw new Error(`group create failed: ${created.status} ${JSON.stringify(created.data)}`)
  }

  let studentsRes = await req('/api/students', { headers })
  if (!studentsRes.ok) throw new Error(`students GET failed: ${studentsRes.status}`)
  let students = Array.isArray(studentsRes.data) ? studentsRes.data : []

  let createdStudents = 0
  let updatedStudents = 0
  let createdParents = 0
  let updatedParents = 0
  let skippedParents = 0

  for (const row of rows) {
    const foundStudent = students.find((student) => String(student?.username || '').toLowerCase() === row.studentUsername.toLowerCase())

    if (!foundStudent) {
      const createStudent = await req('/api/students', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: row.studentName,
          phone: row.studentPhone || '',
          group: groupName,
          username: row.studentUsername,
          password: row.studentPassword,
          status: 'active',
        }),
      })
      if (!createStudent.ok) throw new Error(`student create failed (${row.studentUsername}): ${createStudent.status} ${JSON.stringify(createStudent.data)}`)
      createdStudents += 1
    } else {
      const updateStudent = await req('/api/students', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: foundStudent.id,
          adminId,
          fullName: row.studentName,
          phone: row.studentPhone || '',
          group: groupName,
          username: row.studentUsername,
          password: row.studentPassword,
          status: 'active',
        }),
      })
      if (!updateStudent.ok) throw new Error(`student update failed (${row.studentUsername}): ${updateStudent.status} ${JSON.stringify(updateStudent.data)}`)
      updatedStudents += 1
    }

    studentsRes = await req('/api/students', { headers })
    if (!studentsRes.ok) throw new Error(`students refresh failed: ${studentsRes.status}`)
    students = Array.isArray(studentsRes.data) ? studentsRes.data : []

    if (!row.parentUsername || !row.parentPassword) {
      skippedParents += 1
      continue
    }

    const student = students.find((item) => String(item?.username || '').toLowerCase() === row.studentUsername.toLowerCase())
    if (!student) throw new Error(`student not found after save: ${row.studentUsername}`)

    const parentsRes = await req('/api/parents', { headers })
    if (!parentsRes.ok) throw new Error(`parents GET failed: ${parentsRes.status}`)
    const parents = Array.isArray(parentsRes.data) ? parentsRes.data : []

    const foundParent = parents.find((parent) => String(parent?.username || '').toLowerCase() === row.parentUsername.toLowerCase())

    const payload = {
      fullName: row.parentName,
      username: row.parentUsername,
      password: row.parentPassword,
      phone: row.parentPhone || '',
      studentId: String(student.id),
      studentIds: [String(student.id)],
    }

    if (!foundParent) {
      const createParent = await req('/api/parents', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (createParent.ok) {
        createdParents += 1
      } else {
        const duplicatePhone = createParent.status === 409 && String(createParent?.data?.error || '').includes('telefon raqam')
        if (!duplicatePhone) {
          throw new Error(`parent create failed (${row.parentUsername}): ${createParent.status} ${JSON.stringify(createParent.data)}`)
        }

        const normalizedTargetPhone = normalizePhone(row.parentPhone)
        const phoneOwner = parents.find((parent) => normalizePhone(parent?.normalizedPhone || parent?.phone) === normalizedTargetPhone)
        if (!phoneOwner) {
          throw new Error(`parent duplicate phone owner not found (${row.parentUsername})`)
        }

        const ownerStudentIds = Array.isArray(phoneOwner?.studentIds)
          ? phoneOwner.studentIds.map((id) => String(id))
          : (phoneOwner?.studentId ? [String(phoneOwner.studentId)] : [])
        const mergedStudentIds = Array.from(new Set([...ownerStudentIds, String(student.id)]))

        const forceUpdate = await req('/api/parents', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            id: phoneOwner.id,
            adminId,
            fullName: row.parentName || phoneOwner.fullName,
            username: row.parentUsername,
            password: row.parentPassword,
            phone: row.parentPhone || phoneOwner.phone || '',
            studentId: mergedStudentIds[0],
            studentIds: mergedStudentIds,
          }),
        })

        if (!forceUpdate.ok) {
          throw new Error(`parent conflict update failed (${row.parentUsername}): ${forceUpdate.status} ${JSON.stringify(forceUpdate.data)}`)
        }

        updatedParents += 1
      }
    } else {
      const existingStudentIds = Array.isArray(foundParent?.studentIds)
        ? foundParent.studentIds.map((id) => String(id))
        : (foundParent?.studentId ? [String(foundParent.studentId)] : [])
      const mergedStudentIds = Array.from(new Set([...existingStudentIds, String(student.id)]))

      const updateParent = await req('/api/parents', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: foundParent.id,
          adminId,
          fullName: row.parentName,
          username: row.parentUsername,
          password: row.parentPassword,
          phone: row.parentPhone || foundParent.phone || '',
          studentId: mergedStudentIds[0],
          studentIds: mergedStudentIds,
        }),
      })

      if (!updateParent.ok) {
        throw new Error(`parent update failed (${row.parentUsername}): ${updateParent.status} ${JSON.stringify(updateParent.data)}`)
      }

      updatedParents += 1
    }
  }

  const verifyStudentsRes = await req('/api/students', { headers })
  const verifyParentsRes = await req('/api/parents', { headers })
  const verifyStudents = Array.isArray(verifyStudentsRes.data) ? verifyStudentsRes.data : []
  const verifyParents = Array.isArray(verifyParentsRes.data) ? verifyParentsRes.data : []

  const targetStudents = verifyStudents.filter((student) => String(student?.group || '').trim().toLowerCase() === groupName.toLowerCase())
  const targetParents = verifyParents.filter((parent) => /^p\d{2}/i.test(String(parent?.username || '')))

  console.log('✅ ELEMENTARY-LITSEY import yakunlandi')
  console.log(JSON.stringify({
    adminId,
    groupName,
    createdStudents,
    updatedStudents,
    createdParents,
    updatedParents,
    skippedParents,
    groupStudentsCount: targetStudents.length,
    prefixedParentsCount: targetParents.length,
  }, null, 2))
}

run().catch((error) => {
  console.error('❌ Import failed:', error.message)
  process.exit(1)
})
