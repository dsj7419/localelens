import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "LocaleLens - AI-Powered Marketing Localization",
  description:
    "Local-first tool for localizing marketing visuals using AI image generation. Replace text in any language while preserving design integrity.",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
