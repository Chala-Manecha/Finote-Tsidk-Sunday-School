import type { Metadata } from 'next';
import './globals.css';
import { SCHOOL_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: SCHOOL_NAME,
  description: 'ፍኖተ ጽድቅ ሰንበት ትምህርት ቤት — አቃቂ ቃሊቲ, ደብረ ጽጌ ቅዱስ ሩፋኤል ቤተክርስቲያን',
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
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Ethiopic:wght@500;700&family=Noto+Sans+Ethiopic:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
