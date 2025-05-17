
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
        '*.cloudworkstations.dev', // Joker général
        'http://*.cloudworkstations.dev',
        'https://*.cloudworkstations.dev',
        // Origines spécifiques des logs, avec http et https
        'https://9000-firebase-studio-1747470456906.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
        'http://9000-firebase-studio-1747470456906.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
        'https://6000-firebase-studio-1747470456906.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
        'http://6000-firebase-studio-1747470456906.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
    ],
  },
};

export default nextConfig;
