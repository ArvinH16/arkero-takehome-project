import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OrgProvider } from "@/lib/context/org-context";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Touchline - Game Day Operations",
  description: "Multi-tenant game day operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <OrgProvider>
          {children}
          <Toaster />
        </OrgProvider>
      </body>
    </html>
  );
}
