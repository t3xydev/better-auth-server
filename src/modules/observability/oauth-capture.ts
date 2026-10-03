import { type OAuthOutcomeInput, oauthOutcomeProperties } from "./oauth-events"
import { captureServerEvent } from "./posthog-server"

export function captureOAuthOutcome(input: OAuthOutcomeInput) {
    const outcome = oauthOutcomeProperties(input)
    if (!outcome) return null
    return captureServerEvent(
        outcome.event,
        outcome.distinctId,
        outcome.properties
    )
}
