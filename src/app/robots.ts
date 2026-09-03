import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://youvo.ai';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/search?*', // Prevent indexing internal search state URLs
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
