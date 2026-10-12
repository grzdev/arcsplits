/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '/arcsplits',
  assetPrefix: '/arcsplits',
  trailingSlash: true,
};

export default nextConfig;
