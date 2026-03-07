import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import prisma from '../lib/prisma'
import { decodeParentMetadata, encodeParentMetadata } from '../lib/utils/parentAuth'

type PairRow = {
  studentName: string
  studentPhone?: string
  studentUsername: string
  studentPassword: string
  parentName: string
  parentPhone?: string
  parentUsername: string
  parentPassword: string
}

const GROUP_NAME = 'CEFR PRO'
const GROUP_LEVEL = 'Intermediate'

const rows: PairRow[] = [
  {
    studentName: 'Ruzmatov Nurmuhammad',
    studentPhone: '+998 97 811 20 30',
    studentUsername: 'u01ruzma',
    studentPassword: 'ukv#001',
    parentName: 'Ismoilova Zarinaxon',
    parentPhone: '+998 97 811 20 30',
    parentUsername: 'p01ismoi',
    parentPassword: 'ota#001',
  },
  {
    studentName: 'Murodjonov Mehrojiddin',
    studentPhone: '+998 91 159 03 13',
    studentUsername: 'u02murod',
    studentPassword: 'ukv#002',
    parentName: 'Karayev Mehtiboyev',
    parentPhone: '+998 91 159 03 13',
    parentUsername: 'p02karay',
    parentPassword: 'ota#002',
  },
  {
    studentName: 'Mirzohid',
    studentPhone: '+998 77 288 12 81',
    studentUsername: 'u03mirzo',
    studentPassword: 'ukv#003',
    parentName: "Yo'ldoshova Dilnoza",
    parentPhone: '+998 77 288 12 81',
    parentUsername: 'p03yoldo',
    parentPassword: 'ota#003',
  },
  {
    studentName: 'Ruzmatjonova Farangiz',
    studentPhone: '+998 91 661 80 90',
    studentUsername: 'u04ruzma',
    studentPassword: 'ukv#004',
    parentName: 'Zarafjon Arentayev',
    parentPhone: '+998 91 661 80 90',
    parentUsername: 'p04zaraf',
    parentPassword: 'ota#004',
  },
  {
    studentName: 'Yusupova Arofat',
    studentPhone: '+998 91 655 84 80',
    studentUsername: 'u05yusup',
    studentPassword: 'ukv#005',
    parentName: "Abdulvohidov Turg'unjon",
    parentPhone: '+998 91 655 84 80',
    parentUsername: 'p05abdul',
    parentPassword: 'ota#005',
  },
  {
    studentName: 'Muxlisa',
    studentPhone: '+998 91 044 63 10',
    studentUsername: 'u06muxli',
    studentPassword: 'ukv#006',
    parentName: 'Abdullayeva Nerdilgoren',
    parentPhone: '+998 77 012 12 85',
    parentUsername: 'p06abdul',
    parentPassword: 'ota#006',
  },
  {
    studentName: "Shodroimov Ro'zixo'ja",
    studentPhone: '+998 91 105 35 36',
    studentUsername: 'u07shodr',
    studentPassword: 'ukv#007',
    parentName: 'Uzaqova Dilbar',
    parentPhone: '+998 91 105 35 36',
    parentUsername: 'p07uzaqo',
    parentPassword: 'ota#007',
  },
  {
    studentName: 'Xudoybeganova Xotima',
    studentPhone: '+998 90 277 75 87',
    studentUsername: 'u08xudoy',
    studentPassword: 'ukv#008',
    parentName: "Yo'ldasheva Nargizaxon",
    parentPhone: '+998 90 277 75 87',
    parentUsername: 'p08yolda',
    parentPassword: 'ota#008',
  },
  {
    studentName: 'Mirzahamdamova Muhinabonu',
    studentPhone: '+998 91 118 02 81',
    studentUsername: 'u09mirza',
    studentPassword: 'ukv#009',
    parentName: 'Saydaxmedova Masturaxon',
    parentPhone: '+998 91 118 02 81',
    parentUsername: 'p09sayda',
    parentPassword: 'ota#009',
  },
  {
    studentName: 'Madinaxon',
    studentPhone: '+998 95 975 28 88',
    studentUsername: 'u10madin',
    studentPassword: 'ukv#010',
    parentName: 'Turdiyeva Nodiraxon',
    parentPhone: '+998 95 975 28 88',
    parentUsername: 'p10turdi',
    parentPassword: 'ota#010',
  },
  {
    studentName: 'Jahongir Marupov',
    studentPhone: '+998 88 209 23 05',
    studentUsername: 'u11jahon',
    studentPassword: 'ukv#011',
    parentName: 'Mohida Ermatova',
    parentPhone: '+998 88 209 23 05',
    parentUsername: 'p11mohid',
    parentPassword: 'ota#011',
  },
]

const PARENT_LEGACY_SELECT = {
  id: true,
  adminId: true,
  fullName: true,
  email: true,
  phone: true,
  createdAt: true,
} as const

function loadEnv() {
  const explicitPath = process.argv[2]
  const candidates = [
    explicitPath,
    '.env.local',
    '.env.production.local',
    '.env',
  ].filter(Boolean) as string[]

  for (const item of candidates) {
    const abs = path.resolve(process.cwd(), item)
    if (!fs.existsSync(abs)) continue
    dotenv.config({ path: abs, override: false })
    break
  }
}

function cleanPhone(raw?: string) {
  return String(raw || '').trim()
}

function readCliArg(prefix: string) {
  const match = process.argv.find((item) => item.startsWith(prefix))
  if (!match) return ''
  return String(match.slice(prefix.length)).trim()
}

async function createParentLegacy(input: {
  adminId?: number | null
  fullName: string
  email?: string | null
  encodedPhone: string | null
}) {
  const result = await prisma.$queryRawUnsafe<Array<{
    id: number
    adminId: number | null
    fullName: string
    email: string | null
    phone: string | null
    createdAt: Date
  }>>(
    `
      INSERT INTO "Parent" ("adminId", "fullName", "email", "phone", "createdAt")
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING "id", "adminId", "fullName", "email", "phone", "createdAt"
    `,
    input.adminId ?? null,
    input.fullName,
    input.email ?? null,
    input.encodedPhone,
  )

  return result?.[0] || null
}

async function run() {
  loadEnv()

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL topilmadi. Env faylni uzating: ts-node scripts/import-cefr-pro.ts .env.production.local')
  }

  const adminUsername = readCliArg('--admin-username=') || 'admin'
  const adminIdFromCli = Number(readCliArg('--admin-id='))

  let admin = null as { id: number; username: string } | null
  let adminId: number | null = null

  if (Number.isFinite(adminIdFromCli) && adminIdFromCli > 0) {
    adminId = adminIdFromCli
    admin = await prisma.admin.findUnique({ where: { id: adminIdFromCli }, select: { id: true, username: true } })
  } else {
    admin =
      (await prisma.admin.findFirst({ where: { username: adminUsername }, select: { id: true, username: true } })) ||
      (await prisma.admin.findFirst({ where: { username: 'kevin_teacher' }, select: { id: true, username: true } })) ||
      (await prisma.admin.findFirst({ orderBy: { id: 'asc' }, select: { id: true, username: true } }))

    adminId = admin?.id ?? 1
  }

  if (!admin) {
    console.warn(`⚠️ Admin topilmadi. Fallback adminId=${adminId} ishlatiladi.`)
  }

  const existingGroup = await prisma.group.findFirst({
    where: { name: GROUP_NAME },
    select: { id: true, name: true, level: true, adminId: true },
  })

  const group = existingGroup
    ? await prisma.group.update({
        where: { id: existingGroup.id },
        data: { adminId },
        select: { id: true, name: true, level: true, adminId: true },
      })
    : await prisma.group.create({
        data: {
          name: GROUP_NAME,
          level: GROUP_LEVEL,
          adminId,
        },
        select: { id: true, name: true, level: true, adminId: true },
      })

  const allParents = await prisma.parent.findMany({
    where: adminId ? { adminId } : undefined,
    select: PARENT_LEGACY_SELECT,
    orderBy: { createdAt: 'desc' },
  })

  let studentsInsertedOrUpdated = 0
  let parentsInsertedOrUpdated = 0

  for (const row of rows) {
    const student = await prisma.student.upsert({
      where: { username: row.studentUsername },
      create: {
        adminId,
        fullName: row.studentName,
        email: `${row.studentUsername}@cefrpro.local`,
        phone: cleanPhone(row.studentPhone),
        username: row.studentUsername,
        password: row.studentPassword,
        status: 'active',
        group: group.name,
      },
      update: {
        adminId,
        fullName: row.studentName,
        phone: cleanPhone(row.studentPhone),
        password: row.studentPassword,
        status: 'active',
        group: group.name,
      },
      select: { id: true, username: true },
    })
    studentsInsertedOrUpdated += 1

    const matchedParent = allParents.find((parent) => {
      const meta = decodeParentMetadata(parent.phone)
      return String(meta?.username || '').trim().toLowerCase() === row.parentUsername.toLowerCase()
    })

    const encodedPhone = encodeParentMetadata({
      username: row.parentUsername,
      password: row.parentPassword,
      studentId: String(student.id),
      phone: cleanPhone(row.parentPhone) || undefined,
    })

    if (matchedParent) {
      await prisma.parent.update({
        where: { id: matchedParent.id },
        data: {
          fullName: row.parentName,
          phone: encodedPhone,
          adminId,
        },
        select: PARENT_LEGACY_SELECT,
      })
      parentsInsertedOrUpdated += 1
      continue
    }

    await createParentLegacy({
      adminId,
      fullName: row.parentName,
      email: null,
      encodedPhone,
    })
    parentsInsertedOrUpdated += 1
  }

  console.log('✅ CEFR PRO import yakunlandi')
  console.log(`Admin scope: ${admin ? `${admin.username} (id=${admin.id})` : 'NULL (global)'}`)
  console.log(`Admin target: username=${adminUsername}, adminId=${adminId}`)
  console.log(`Guruh: ${group.name} [${group.level || '-'}], adminId=${group.adminId ?? 'NULL'}`)
  console.log(`Studentlar: ${studentsInsertedOrUpdated}`)
  console.log(`Ota-onalar: ${parentsInsertedOrUpdated}`)
}

run()
  .catch((error) => {
    console.error('❌ Import xatosi:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
