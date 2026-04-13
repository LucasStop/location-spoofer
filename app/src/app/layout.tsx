import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Location Spoofer",
  description: "Private iOS location simulator",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spoofer",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full overflow-hidden bg-black text-white">
        {children}
      </body>
    </html>
  );
}
