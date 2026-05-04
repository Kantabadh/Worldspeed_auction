import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motorcycle Offer System",
  description: "Digital motorcycle auction offer system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}