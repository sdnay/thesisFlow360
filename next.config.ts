
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
        '*.cloudworkstations.dev', // Permet les sous-domaines de cloudworkstations.dev
        // Ajoutez d'autres origines si nécessaire, par exemple pour des tunnels locaux
        // 'http://localhost:3000', // Si vous accédez parfois via un port différent
    ],
  },
};

export default nextConfig;
