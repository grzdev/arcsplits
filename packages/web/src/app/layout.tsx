import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArcSplits — Composable Native USDC Revenue Splitting on Arc L1",
  description: "Deploy trustless, automated revenue splits and payouts in native USDC on Circle's Arc L1 blockchain.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#0A0C10] text-[#E6E8EC] antialiased selection:bg-[#0A84FF] selection:text-white">
        {children}
      </body>
    </html>
  );
}
