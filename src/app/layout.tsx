import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import type { ReactNode } from "react"

import "@/styles/globals.css"

import { Header } from "@/components/header"
import { SiteChrome } from "@/components/site-chrome"
import { Providers } from "./providers"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"]
})

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"]
})

const appName = process.env.APPLICATION_NAME || "Better Auth Server"
const primaryHue = process.env.NEXT_PUBLIC_PRIMARY_HUE
const primaryChroma = process.env.NEXT_PUBLIC_PRIMARY_CHROMA
const faviconUrl = process.env.FAVICON_URL
const iconUrl = process.env.ICON_URL
const ogImageUrl = process.env.OPENGRAPH_IMAGE_URL

export const metadata: Metadata = {
    metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
    title: appName,
    description:
        "Deploy-ready Better Auth server — OAuth/OIDC, passkeys, 2FA, invites, and an admin panel for OAuth clients.",
    icons: {
        icon: faviconUrl || "/icon.svg",
        apple: iconUrl || "/apple-touch-icon.png"
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: appName
    },
    openGraph: {
        title: appName,
        description:
            "Deploy-ready Better Auth server — OAuth/OIDC, passkeys, 2FA, and admin tools.",
        siteName: appName,
        ...(ogImageUrl && { images: [{ url: ogImageUrl }] })
    }
}

export const viewport: Viewport = {
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
    width: "device-width"
}

export default function RootLayout({
    children
}: Readonly<{
    children: ReactNode
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            style={{
                ...(primaryHue && { "--primary-hue": primaryHue }),
                ...(primaryChroma && { "--primary-chroma": primaryChroma }),
            } as React.CSSProperties}
        >
            <body
                className={`${geistSans.variable} ${geistMono.variable} flex min-h-svh flex-col antialiased`}
            >
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
(function(){
  var mv = document.querySelector('meta[name=viewport]');
  if (mv) mv.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no');
  document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
  document.addEventListener('gesturechange', function(e){ e.preventDefault(); });
  document.addEventListener('touchstart', function(e){
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js');
    });
  }
})();
`
                    }}
                />
                <Providers>
                    <SiteChrome header={<Header />}>{children}</SiteChrome>
                </Providers>
            </body>
        </html>
    )
}
