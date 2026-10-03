import { registerOtel } from "./otel"
import { initSentryServer } from "./sentry"

let registered = false

export function registerNodeObservability() {
    if (registered) return
    registered = true
    const otelActive = registerOtel()
    initSentryServer(otelActive)
}
