const { PrismaClient } = require('@prisma/client')

// Prisma 7+ uchun konfiguratsiyani aniq ko'rsatamiz
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('🔄 Guruhlar bazaga qo\'shilmoqda...')
  
  const groups = [
    { name: 'IELTS' },
    { name: 'CEFR' }
  ]

  for (const group of groups) {
    await prisma.group.upsert({
      where: { id: group.name }, // id sifatida name ishlatdik
      update: {},
      create: {
        name: group.name
      },
    })
  }

  console.log('✅ Guruhlar muvaffaqiyatli yaratildi: IELTS va CEFR')
}

main()
  .catch((e) => {
    console.error('❌ Xato yuz berdi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
