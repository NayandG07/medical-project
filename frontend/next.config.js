/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@supabase/supabase-js'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Polyfill require for browser
      config.resolve.alias = {
        ...config.resolve.alias,
      };
      
      // Ignore node: protocol imports on client side
      config.externals = config.externals || [];
      config.externals.push({
        'node:module': 'commonjs node:module',
        'node:fs': 'commonjs node:fs',
        'node:path': 'commonjs node:path',
      });
      
      // Add fallbacks for node modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig
