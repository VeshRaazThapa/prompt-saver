import type { MetadataRoute } from 'next';

const SITE = 'https://promptsaver.online';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
