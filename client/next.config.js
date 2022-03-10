/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  images: {
    deviceSizes: [120, 220, 320, 420, 768, 1024, 1200],
    // iconSizes: [],
    domains: ['127.0.0.1'],
    path: '/_next/image',
    loader: 'default'
  },
  env: {
    MEDIA_URL: 'http://127.0.0.1:5000/media',
  }
}

module.exports = nextConfig
