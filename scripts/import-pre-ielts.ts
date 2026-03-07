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

const GROUP_NAME = 'Intermediate (Pre-IELTS)'
const GROUP_LEVEL = 'Intermediate'

const rows: PairRow[] = [
  {
    studentName: 'Siddiqova Nadirabegim',
    studentPhone: '+998 88 876 14 44',
    studentUsername: 'u01siddi',
    studentPassword: 'ukv#001',
    parentName: 'Muminova Gulnoza',
    parentPhone: '+998 88 876 14 44',
    parentUsername: 'p01mumin',
    parentPassword: 'ota#001',
  },
  {
    studentName: 'Abdullayeva Shukriona',
    studentPhone: '+998 91 325 03 73',
    studentUsername: 'u02abdul',
    studentPassword: 'ukv#002',
    parentName: 'Abdullayeva Dilrabaxon',
    parentPhone: '+998 91 325 03 73',
    parentUsername: 'p02abdul',
    parentPassword: 'ota#002',
  },
  {
    studentName: "Abdullayeva Dilafro'z",
    studentPhone: '998700393443',
    studentUsername: 'u03abdul',
    studentPassword: 'ukv#003',
    parentName: "Shokirxo'jayev Shukhro'ja",
    parentPhone: '998700393443',
    parentUsername: 'p03shoki',
    parentPassword: 'ota#003',
  },
  {
    studentName: 'Olimjonova Dilnavoz',
    studentPhone: '+998 91 130 89 69',
    studentUsername: 'u04olimj',
    studentPassword: 'ukv#004',
    parentName: 'Abduvosidova Sarvinoz',
    parentPhone: '+998 91 130 89 69',
    parentUsername: 'p04abduv',
    parentPassword: 'ota#004',
  },
  {
    studentName: "To'xtoshinov Mirzohid",
    studentPhone: '+998 91 113 32 08',
    studentUsername: 'u05toxto',
    studentPassword: 'ukv#005',
    parentName: 'Buzrukova Roxizon',
    parentPhone: '+998 91 113 32 08',
    parentUsername: 'p05buxru',
    parentPassword: 'ota#005',
  },
  {
    studentName: "Murodjonov Muhammadxo'ja",
    studentPhone: '+998 91 189 02 13',
    studentUsername: 'u06murod',
    studentPassword: 'ukv#006',
    parentName: 'Xolmatova Xayotxon',
    parentPhone: '+998 91 189 02 13',
    parentUsername: 'p06xolma',
    parentPassword: 'ota#006',
  },
  {
    studentName: "A'zamjonov Asror",
    studentPhone: '+998 90 105 03 04',
    studentUsername: 'u07azamj',
    studentPassword: 'ukv#007',
    parentName: 'Dilnoza Xolmonova',
    parentPhone: '+998 90 105 03 04',
    parentUsername: 'p07dilno',
    parentPassword: 'ota#007',
  },
  {
    studentName: 'Valijonova Mohichehra',
    studentPhone: '+998 88 628 12 21',
    studentUsername: 'u08valij',
    studentPassword: 'ukv#008',
    parentName: 'Ergasheva Gavharoy',
    parentPhone: '+998 88 628 12 21',
    parentUsername: 'p08ergas',
    parentPassword: 'ota#008',
  },
  {
    studentName: "O'tkirova Shodiyona",
    studentPhone: '+998 91 648 65 54',
    studentUsername: 'u09otkir',
    studentPassword: 'ukv#009',
    parentName: 'Uraimova Yorqinoy',
    parentPhone: '+998 91 648 65 54',
    parentUsername: 'p09uraim',
    parentPassword: 'ota#009',
  },
  {
    studentName: 'Rahimova Dilnavoz',
    studentPhone: '+998 91 158 01 87',
    studentUsername: 'u10rahim',
    studentPassword: 'ukv#010',
    parentName: "Bilolova Dilafro'z",
    parentPhone: '+998 91 158 01 87',
    parentUsername: 'p10bilol',
    parentPassword: 'ota#010',
  },
  {
    studentName: 'Komiljonova Mohlaroy',
    studentPhone: '',
    studentUsername: 'u11komil',
    studentPassword: 'ukv#011',
    parentName: 'Dadaxonova Irodaxon',
    parentPhone: '',
    parentUsername: 'p11dadax',
    parentPassword: 'ota#011',
  },
  {
    studentName: "Xolxo'jayeva Bibisora",
    studentPhone: '+998 90 408 59 75',
    studentUsername: 'u12xolxo',
    studentPassword: 'ukv#012',
    parentName: 'Saydaxmedova Gulhayo',
    parentPhone: '+998 90 408 59 75',
    parentUsername: 'p12sayda',
    parentPassword: 'ota#012',
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
  const rows = await prisma.$queryRawUnsafe<Array<{
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

  return rows?.[0] || null
}

async function run() {
  loadEnv()

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL topilmadi. Env faylni uzating: ts-node scripts/import-pre-ielts.ts .env.production.local')
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

  const group = await prisma.group.upsert({
    where: { name: GROUP_NAME },
    create: {
      name: GROUP_NAME,
      level: GROUP_LEVEL,
      adminId,
    },
    update: {
      level: GROUP_LEVEL,
      adminId,
    },
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
        email: `${row.studentUsername}@preielts.local`,
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

  console.log('✅ Import yakunlandi')
  console.log(`Admin scope: ${admin ? `${admin.username} (id=${admin.id})` : 'NULL (global)'}`)
  console.log(`Admin target: username=${adminUsername}, adminId=${adminId}`)
  console.log(`Guruh: ${group.name} [${group.level || '-'}]`)
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
