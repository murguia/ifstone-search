import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "I.F. Stone's Weekly Search",
  description: "AI-powered semantic search across I.F. Stone's Weekly, one of the most influential independent newsletters in American journalism (1953-1971).",
  openGraph: {
    title: "I.F. Stone's Weekly Search",
    description: "AI-powered semantic search across I.F. Stone's Weekly (1953-1971). Ask questions and get answers grounded in the original articles.",
    url: "https://ifstone-search.vercel.app",
    siteName: "I.F. Stone's Weekly Search",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "I.F. Stone's Weekly Search",
    description: "AI-powered semantic search across I.F. Stone's Weekly (1953-1971).",
  },
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
