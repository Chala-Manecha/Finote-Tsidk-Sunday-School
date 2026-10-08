import type { Metadata } from 'next';
import './globals.css';
import { CHURCH_NAME, SCHOOL_NAME } from '@/lib/constants';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  title: SCHOOL_NAME,
  description: `${SCHOOL_NAME} — ${CHURCH_NAME}፣ አቃቂ ቃሊቲ`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="am">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Ethiopic:wght@400;500;600;700;800&family=Noto+Serif+Ethiopic:wght@500;700&display=swap"
        />
      </head>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
