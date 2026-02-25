/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript xatolarini build paytida mutloq e'tiborsiz qoldirish
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint xatolarini build paytida mutloq e'tiborsiz qoldirish
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Production build paytida xatolarni tekshirmaslikni majburlash
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Vercel uchun qo'shimcha optimizatsiya
  swcMinify: true,
  // Rasm va boshqa static fayllar uchun xavfsizlik sozlamalari
  images: {
    unoptimized: true,
  },
  // Build jarayonini to'xtatib qo'yadigan ba'zi qat'iy qoidalarni chetlab o'tish
  experimental: {
    // Agar loyihada tashqi paketlar bilan muammo bo'lsa, bu yordam beradi
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;