import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RMA 退货管理',
  description: '多租户 3PL 退货管理平台',
  applicationName: 'RMA',
  icons: {
    icon: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'RMA',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f6e6b',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#f4f6f8] text-[#122033] antialiased">{children}</body>
    </html>
  );
}
