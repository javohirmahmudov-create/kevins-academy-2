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
  // Vercel uchun qo'shimcha optimizatsiya
  swcMinify: true,
  // Rasm va boshqa static fayllar uchun xavfsizlik sozlamalari
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
