import type { Metadata, Viewport } from "next";
import { Prompt, Geist_Mono } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Feature 7: installable PWA. manifest.json + appleWebApp make the dashboard
// addable to a phone's home screen with its own icon and standalone window
// (no browser chrome). Intentionally no push-notification setup here — the
// plan called for a simple installable PWA only.
export const metadata: Metadata = {
  title: "Battery Central — ระบบติดตามแบตเตอรี่",
  description: "แดชบอร์ดติดตามระดับแบตเตอรี่และประเมินเวลาการใช้งานแบบเรียลไทม์ รองรับ Windows, iOS, Android และ IoT",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Battery Central",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${prompt.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
