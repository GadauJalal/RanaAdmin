import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { WorkspaceProvider } from "@/providers/workspace-provider";

import "./globals.css";

const jagerlay = localFont({
  variable: "--font-jagerlay",
  display: "swap",
  fallback: ["Arial Black", "sans-serif"],
  src: [
    { path: "../../public/fonts/Jagerlay-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/Jagerlay-ExtraBold.ttf", weight: "800", style: "normal" }
  ]
});

const goli = localFont({
  variable: "--font-goli",
  display: "swap",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  src: [
    { path: "../../public/fonts/Goli-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Goli-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/Goli-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/Goli-Bold.ttf", weight: "700", style: "normal" }
  ]
});

export const metadata: Metadata = {
  title: {
    default: "Rana54 Network Operations",
    template: "%s | Rana54 Network Operations"
  },
  description: "Rana54 Network Operations workspace",
  icons: { icon: "/assets/rana54-mark.png" }
};

export const viewport: Viewport = {
  themeColor: "#13211A",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jagerlay.variable} ${goli.variable}`}>
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
