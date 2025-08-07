import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['ws'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Исключаем WebSocket из клиентского бандла
      config.externals = config.externals || []
      config.externals.push('ws')
    }
    return config
  },
}

export default nextConfig
