import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    const appName = process.env.APPLICATION_NAME || "Better Auth Server"
    const iconUrl = process.env.ICON_URL

    return {
        name: appName,
        short_name: appName,
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: iconUrl
            ? [{ src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any" }]
            : [
                  {
                      src: "/icon-192.png",
                      sizes: "192x192",
                      type: "image/png",
                      purpose: "any"
                  },
                  {
                      src: "/icon-512.png",
                      sizes: "512x512",
                      type: "image/png",
                      purpose: "any"
                  }
              ]
    }
}
