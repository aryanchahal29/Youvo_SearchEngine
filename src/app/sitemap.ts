import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://youvo.ai';
  const supabase = await createClient();

  // Fetch only VERIFIED or RANKED tools to avoid indexing junk/low-quality items
  const { data: tools } = await supabase
    .from('tools')
    .select('slug, updated_at')
    .in('status', ['VERIFIED', 'RANKED', 'RECOMMENDED']);

  const toolUrls = (tools || []).map((tool) => ({
    url: `${baseUrl}/tools/${tool.slug}`,
    lastModified: new Date(tool.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Fetch categories
  const { data: categories } = await supabase
    .from('tool_categories')
    .select('slug, updated_at');

  const categoryUrls = (categories || []).map((cat) => ({
    url: `${baseUrl}/category/${cat.slug}`,
    lastModified: new Date(cat.updated_at),
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    ...categoryUrls,
    ...toolUrls,
  ];
}
