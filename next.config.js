/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
    // Allow base64 data URLs for student photos
    dangerouslyAllowSVG: true,
  },
};

module.exports = nextConfig;
