import { initPostHogClient } from "@/lib/posthog"
import { initSentryClient } from "@/modules/observability/sentry-client"

initPostHogClient()
initSentryClient()
