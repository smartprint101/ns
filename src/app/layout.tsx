import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-bengali/wght.css";
import "./globals.css";
import { Toaster } from "sonner";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: { default: "এনএস ট্রেডার্স", template: "%s · এনএস ট্রেডার্স" },
  description: "এনএস ট্রেডার্স — প্রাইভেট ব্যবসা ব্যবস্থাপনা: অর্ডার, প্যাকেজিং, পেমেন্ট, কালেকশন, খরচ, টাস্ক",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "এনএস ট্রেডার্স" },
  applicationName: "এনএস ট্রেডার্স",
};

export const viewport: Viewport = {
  themeColor: "#11664f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body className="font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
        <SwRegister />
      </body>
    </html>
  );
}
