import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.svg",
  },
  title: "I.F. Stone's Weekly Search",
  description: "AI-powered semantic search across I.F. Stone's Weekly, one of the most influential independent newsletters in American journalism (1953-1971).",
  openGraph: {
    title: "I.F. Stone's Weekly Search",
    description: "AI-powered semantic search across I.F. Stone's Weekly (1953-1971). Ask questions and get answers grounded in the original articles.",
    url: "https://ifstone-search.vercel.app",
    siteName: "I.F. Stone's Weekly Search",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "I.F. Stone's Weekly Search — AI-powered semantic search",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "I.F. Stone's Weekly Search",
    description: "AI-powered semantic search across I.F. Stone's Weekly (1953-1971).",
    images: ["/og-image.png"],
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
