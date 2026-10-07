"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
    error,
    reset
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <html lang="en">
            <body
                style={{
                    fontFamily: "system-ui, sans-serif",
                    margin: 0,
                    padding: "2rem"
                }}
            >
                <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                    Something went wrong
                </h1>
                <p style={{ color: "#525252" }}>
                    This page could not be displayed. You can try again.
                </p>
                <button
                    type="button"
                    onClick={() => reset()}
                    style={{
                        border: 0,
                        borderRadius: "0.375rem",
                        background: "#171717",
                        color: "#fafafa",
                        padding: "0.5rem 0.75rem"
                    }}
                >
                    Try again
                </button>
            </body>
        </html>
    )
}
