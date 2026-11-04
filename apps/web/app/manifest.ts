import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RMA 退货管理',
    short_name: 'RMA',
    description: '多租户 3PL 退货管理平台',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f6f8',
    theme_color: '#0f6e6b',
    lang: 'zh-CN',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
