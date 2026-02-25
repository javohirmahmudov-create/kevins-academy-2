/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript xatolarini build paytida mutloq e'tiborsiz qoldirish
  typescript: {
    // !! DIQQAT: Bu production build paytida xatolarga qaramay davom etishga ruxsat beradi
    ignoreBuildErrors: true,
  },
  // ESLint xatolarini build paytida mutloq e'tiborsiz qoldirish
  eslint: {
    // !! DIQQAT: Bu build jarayonida ESLint tekshiruvini butunlay o'chiradi
    ignoreDuringBuilds: true,
  },
  // Static export va optimizatsiya sozlamalari
  images: {
    unoptimized: true,
  },
  // Build tezligini oshirish va xatolarni kamaytirish uchun SWC minifikatsiyasi
  swcMinify: true,
  // Ba'zi hollarda build to'xtab qolishini oldini olish uchun
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Experimental sozlamalar
  experimental: {
    // Server Actions sozlamalari
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Webpack konfiguratsiyasini build xatolariga nisbatan chidamliligini oshirish
  webpack: (config, { dev, isServer }) => {
    // Build paytida ogohlantirishlarni kamaytirish
    config.stats = 'errors-only';
    return config;
  },
};

export default nextConfig;