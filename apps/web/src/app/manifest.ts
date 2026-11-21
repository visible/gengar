import type { MetadataRoute } from 'next';
import { DESCRIPTION } from '@/lib/facts';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gengar',
    short_name: 'Gengar',
    description: DESCRIPTION,
    start_url: '/',
    display: 'browser',
    background_color: '#9146ff',
    theme_color: '#9146ff',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' }
    ]
  };
}
