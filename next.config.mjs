/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return ["/account/:path*", "/bill/:path*", "/rent/:path*"].map(source => ({ source, headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "X-Frame-Options", value: "DENY" }
    ] }));
  },
  experimental: {
    typedRoutes: false
  }
};

export default nextConfig;
