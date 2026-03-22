import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "I.F. Stone's Weekly Search",
  description: "AI-powered search through I.F. Stone's Weekly archive (1953-1971)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
