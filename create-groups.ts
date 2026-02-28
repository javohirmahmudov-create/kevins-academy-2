import prisma from './lib/prisma'

async function main() {
  try {
    await prisma.group.createMany({
      data: [
        { name: 'IELTS' },
        { name: 'CEFR' }
      ],
      skipDuplicates: true
    })
    console.log('✅ Guruhlar yaratildi!')
  } catch (e) {
    console.error('Xato:', e)
  }
}
main()
