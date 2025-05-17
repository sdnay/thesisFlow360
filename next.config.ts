
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
        '*.cloudworkstations.dev',         // Joker pour tous les sous-domaines
        'http://*.cloudworkstations.dev',  // Explicitement pour HTTP
        'https://*.cloudworkstations.dev', // Explicitement pour HTTPS
        // Ajoutez d'autres origines spécifiques si les logs en révèlent d'autres
        // Par exemple, si vous voyez des erreurs spécifiques pour des ports :
        // 'http://9000-*.cloudworkstations.dev',
        // 'https://9000-*.cloudworkstations.dev',
        // 'http://6000-*.cloudworkstations.dev',
        // 'https://6000-*.cloudworkstations.dev',
        // Pour l'instant, les jokers de sous-domaines devraient suffire.
    ],
  },
};

export default nextConfig;
