import posthog from "posthog-js"

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const posthogHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

let started = false

export function initPostHogClient() {
    if (started || typeof window === "undefined" || !posthogKey) return
    started = true
    const replay = process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY === "true"
    posthog.init(posthogKey, {
        api_host: "/ingest",
        ui_host: posthogHost,
        capture_pageview: false,
        capture_pageleave: true,
        disable_session_recording: !replay,
        session_recording: {
            maskAllInputs: true,
            maskTextSelector: "*"
        }
    })
}

export default posthog
