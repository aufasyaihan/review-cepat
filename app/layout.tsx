import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { RootProvider } from '@/providers/root-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'NFC Platform — NFC & QR Redirect SaaS',
    template: '%s | NFC Platform',
  },
  description:
    'Turn physical NFC tags and QR codes into instant redirects to Google Reviews and social links, with scan analytics.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <RootProvider>
          <Toaster richColors closeButton position="top-right" />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        </RootProvider>
      </body>
    </html>
  );
}
