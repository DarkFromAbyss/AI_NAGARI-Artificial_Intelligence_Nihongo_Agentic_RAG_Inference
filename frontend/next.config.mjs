/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Proxy API routes to backend
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: process.env.NEXT_PUBLIC_BACKEND_URL 
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/:path*`
        : 'http://localhost:8000/api/:path*',
    },
  ],
}

export default nextConfig
