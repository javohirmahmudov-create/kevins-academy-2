const BASE = 'https://kevins-academy.com'

const rows = [
  { studentName: 'Siddiqova Nadirabegim', studentPhone: '+998 88 876 14 44', studentUsername: 'u01siddi', studentPassword: 'ukv#001', parentName: 'Muminova Gulnoza', parentPhone: '+998 88 876 14 44', parentUsername: 'p01mumin', parentPassword: 'ota#001' },
  { studentName: 'Abdullayeva Shukriona', studentPhone: '+998 91 325 03 73', studentUsername: 'u02abdul', studentPassword: 'ukv#002', parentName: 'Abdullayeva Dilrabaxon', parentPhone: '+998 91 325 03 73', parentUsername: 'p02abdul', parentPassword: 'ota#002' },
  { studentName: "Abdullayeva Dilafro'z", studentPhone: '998700393443', studentUsername: 'u03abdul', studentPassword: 'ukv#003', parentName: "Shokirxo'jayev Shukhro'ja", parentPhone: '998700393443', parentUsername: 'p03shoki', parentPassword: 'ota#003' },
  { studentName: 'Olimjonova Dilnavoz', studentPhone: '+998 91 130 89 69', studentUsername: 'u04olimj', studentPassword: 'ukv#004', parentName: 'Abduvosidova Sarvinoz', parentPhone: '+998 91 130 89 69', parentUsername: 'p04abduv', parentPassword: 'ota#004' },
  { studentName: "To'xtoshinov Mirzohid", studentPhone: '+998 91 113 32 08', studentUsername: 'u05toxto', studentPassword: 'ukv#005', parentName: 'Buzrukova Roxizon', parentPhone: '+998 91 113 32 08', parentUsername: 'p05buxru', parentPassword: 'ota#005' },
  { studentName: "Murodjonov Muhammadxo'ja", studentPhone: '+998 91 189 02 13', studentUsername: 'u06murod', studentPassword: 'ukv#006', parentName: 'Xolmatova Xayotxon', parentPhone: '+998 91 189 02 13', parentUsername: 'p06xolma', parentPassword: 'ota#006' },
  { studentName: "A'zamjonov Asror", studentPhone: '+998 90 105 03 04', studentUsername: 'u07azamj', studentPassword: 'ukv#007', parentName: 'Dilnoza Xolmonova', parentPhone: '+998 90 105 03 04', parentUsername: 'p07dilno', parentPassword: 'ota#007' },
  { studentName: 'Valijonova Mohichehra', studentPhone: '+998 88 628 12 21', studentUsername: 'u08valij', studentPassword: 'ukv#008', parentName: 'Ergasheva Gavharoy', parentPhone: '+998 88 628 12 21', parentUsername: 'p08ergas', parentPassword: 'ota#008' },
  { studentName: "O'tkirova Shodiyona", studentPhone: '+998 91 648 65 54', studentUsername: 'u09otkir', studentPassword: 'ukv#009', parentName: 'Uraimova Yorqinoy', parentPhone: '+998 91 648 65 54', parentUsername: 'p09uraim', parentPassword: 'ota#009' },
  { studentName: 'Rahimova Dilnavoz', studentPhone: '+998 91 158 01 87', studentUsername: 'u10rahim', studentPassword: 'ukv#010', parentName: "Bilolova Dilafro'z", parentPhone: '+998 91 158 01 87', parentUsername: 'p10bilol', parentPassword: 'ota#010' },
  { studentName: 'Komiljonova Mohlaroy', studentPhone: '', studentUsername: 'u11komil', studentPassword: 'ukv#011', parentName: 'Dadaxonova Irodaxon', parentPhone: '', parentUsername: 'p11dadax', parentPassword: 'ota#011' },
  { studentName: "Xolxo'jayeva Bibisora", studentPhone: '+998 90 408 59 75', studentUsername: 'u12xolxo', studentPassword: 'ukv#012', parentName: 'Saydaxmedova Gulhayo', parentPhone: '+998 90 408 59 75', parentUsername: 'p12sayda', parentPassword: 'ota#012' },
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
  const groupName = 'Intermediate (Pre-IELTS)'
  const level = 'Intermediate'
  const targetAdminId = 1

  const groupsRes = await req('/api/groups')
  if (!groupsRes.ok) throw new Error(`groups GET failed: ${groupsRes.status}`)
  const groups = Array.isArray(groupsRes.data) ? groupsRes.data : []
  const existingGroup = groups.find((group) => String(group?.name || '').trim() === groupName)
  if (!existingGroup) {
    const createGroup = await req('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name: groupName, level }),
    })
    if (!createGroup.ok) throw new Error(`group create failed: ${createGroup.status} ${JSON.stringify(createGroup.data)}`)
  }

  let studentsRes = await req('/api/students')
  if (!studentsRes.ok) throw new Error(`students GET failed: ${studentsRes.status}`)
  let students = Array.isArray(studentsRes.data) ? studentsRes.data : []

  let createdStudents = 0
  let updatedStudents = 0

  for (const row of rows) {
    const found = students.find((student) => String(student?.username || '').toLowerCase() === row.studentUsername.toLowerCase())
    if (!found) {
      const createStudent = await req('/api/students', {
        method: 'POST',
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
        body: JSON.stringify({
          id: found.id,
          adminId: targetAdminId,
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
  }

  studentsRes = await req('/api/students')
  if (!studentsRes.ok) throw new Error(`students refresh failed: ${studentsRes.status}`)
  students = Array.isArray(studentsRes.data) ? studentsRes.data : []

  let parentsRes = await req('/api/parents')
  if (!parentsRes.ok) throw new Error(`parents GET failed: ${parentsRes.status}`)
  let parents = Array.isArray(parentsRes.data) ? parentsRes.data : []

  let createdParents = 0
  let updatedParents = 0

  for (const row of rows) {
    const student = students.find((item) => String(item?.username || '').toLowerCase() === row.studentUsername.toLowerCase())
    if (!student) throw new Error(`student not found after import: ${row.studentUsername}`)

    const foundParent = parents.find((parent) => String(parent?.username || '').toLowerCase() === row.parentUsername.toLowerCase())

    const payload = {
      fullName: row.parentName,
      username: row.parentUsername,
      password: row.parentPassword,
      phone: row.parentPhone || '',
      studentId: String(student.id),
    }

    if (!foundParent) {
      const createParent = await req('/api/parents', {
        method: 'POST',
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
        const phoneOwner = parents.find((parent) => normalizePhone(parent?.phone) === normalizedTargetPhone)
        if (!phoneOwner) {
          throw new Error(`parent duplicate phone owner not found (${row.parentUsername})`)
        }

        const forceUpdate = await req('/api/parents', {
          method: 'PUT',
          body: JSON.stringify({ id: phoneOwner.id, adminId: targetAdminId, ...payload }),
        })
        if (!forceUpdate.ok) {
          throw new Error(`parent conflict update failed (${row.parentUsername}): ${forceUpdate.status} ${JSON.stringify(forceUpdate.data)}`)
        }
        updatedParents += 1
      }
    } else {
      const updateParent = await req('/api/parents', {
        method: 'PUT',
        body: JSON.stringify({ id: foundParent.id, adminId: targetAdminId, ...payload }),
      })
      if (!updateParent.ok) throw new Error(`parent update failed (${row.parentUsername}): ${updateParent.status} ${JSON.stringify(updateParent.data)}`)
      updatedParents += 1
    }
  }

  parentsRes = await req('/api/parents')
  if (!parentsRes.ok) throw new Error(`parents refresh failed: ${parentsRes.status}`)
  parents = Array.isArray(parentsRes.data) ? parentsRes.data : []

  const targetStudents = students.filter((student) => rows.some((row) => row.studentUsername === student.username))
  const targetParents = parents.filter((parent) => rows.some((row) => row.parentUsername === parent.username))
  const linkedParents = targetParents.filter((parent) => parent?.studentId)

  console.log('✅ Production API import finished')
  console.log('group=', groupName)
  console.log('students(created/updated)=', createdStudents, '/', updatedStudents)
  console.log('parents(created/updated)=', createdParents, '/', updatedParents)
  console.log('targetStudentsCount=', targetStudents.length)
  console.log('targetParentsCount=', targetParents.length)
  console.log('linkedParentsCount=', linkedParents.length)
}

run().catch((error) => {
  console.error('❌ Import failed:', error.message)
  process.exit(1)
})
