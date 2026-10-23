import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
export const metadata: Metadata = {
  title: 'Pollinator — Honey Chain',
  description: 'Smart hive monitoring, honey batch provenance, laboratory evidence and consumer QR verification for beekeeper clusters.',
  icons: { icon: '/favicon.svg', apple: '/apple-icon.png' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
    <body className="min-h-full flex flex-col bg-background text-foreground">
      <Script id="pollinator-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html:
        "(function(){var t;try{t=localStorage.getItem('pollinator-theme')}catch(e){}if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.classList.toggle('light',t==='light');document.documentElement.style.colorScheme=t})()" }} />
      <ThemeProvider>{children}</ThemeProvider>
    </body>
  </html>;
}
