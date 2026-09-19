import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pollinators — Cryptographic Honey Supply Chain & Provenance",
  description: "Next-generation honey supply chain verification powered by Polygon Amoy smart contracts, IPFS metadata anchoring, ESP32 IoT hive monitoring, and AWS Bedrock multilingual AI.",
  icons: {
    icon: [
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png?v=3", type: "image/png", sizes: "16x16" },
      { url: "/favicon.ico?v=3" },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: [
      { url: "/apple-icon.png?v=3", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Explicit Favicon Links with Cache-Busting Query */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png?v=3" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />

        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('pollinator-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'light') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#fbf9f4] dark:bg-[#080a0f] text-slate-900 dark:text-slate-100 selection:bg-yellow-400 selection:text-black transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
