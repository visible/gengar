import type { MetadataRoute } from 'next';
import { SITE, UPDATED } from '@/lib/facts';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/install', '/faq', '/privacy'].map(path => ({
    url: `${SITE}${path}`,
    lastModified: UPDATED
  }));
}
