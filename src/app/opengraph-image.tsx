import { ImageResponse } from "next/og"

export const alt = "Better Auth Server — deploy a production auth server"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
    const cdnUrl = process.env.OPENGRAPH_IMAGE_URL
    if (cdnUrl) {
        const res = await fetch(cdnUrl)
        return new Response(res.body, {
            headers: {
                "Content-Type": res.headers.get("Content-Type") || "image/png",
                "Cache-Control": "public, max-age=86400",
            },
        })
    }

    const appName = process.env.APPLICATION_NAME || "Better Auth Server"

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    width: "100%",
                    height: "100%",
                    padding: "64px 72px",
                    background:
                        "linear-gradient(135deg, #0B1220 0%, #101828 55%, #0A3D3A 100%)",
                    color: "#F8FAFC",
                    fontFamily:
                        "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            background: "#5EEAD4",
                        }}
                    />
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 600,
                            letterSpacing: "-0.02em",
                            color: "#99F6E4",
                        }}
                    >
                        Auth server starter
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div
                        style={{
                            fontSize: 64,
                            fontWeight: 700,
                            letterSpacing: "-0.03em",
                            lineHeight: 1.05,
                            maxWidth: 900,
                        }}
                    >
                        {appName}
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            color: "#CBD5E1",
                            maxWidth: 820,
                            lineHeight: 1.35,
                        }}
                    >
                        OAuth / OIDC · Passkeys · 2FA · Admin panel — deploy in minutes
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        fontSize: 22,
                        color: "#64748B",
                        letterSpacing: "0.02em",
                    }}
                >
                    Next.js · PostgreSQL · Drizzle · Better Auth
                </div>
            </div>
        ),
        { ...size },
    )
}
