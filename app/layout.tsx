import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { RootProvider } from '@/providers/root-provider';
import './globals.css';
import { Inter, Roboto } from 'next/font/google';
import { cn } from '@/lib/utils';
import '@aejkatappaja/phantom-ui/ssr.css';

const interHeading = Inter({ subsets: ['latin'], variable: '--font-heading' });

const roboto = Roboto({ subsets: ['latin'], variable: '--font-sans' });

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
    <html
      lang="en"
      className={cn('h-full antialiased', 'font-sans', roboto.variable, interHeading.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <RootProvider>
          <Toaster richColors position="top-center" duration={3000} />
          <main>{children}</main>
        </RootProvider>
      </body>
    </html>
  );
}
