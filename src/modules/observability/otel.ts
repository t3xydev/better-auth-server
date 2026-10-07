import type { Span } from "@opentelemetry/api"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici"
import { resourceFromAttributes } from "@opentelemetry/resources"
import {
    BatchSpanProcessor,
    ParentBasedSampler,
    TraceIdRatioBasedSampler
} from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"

import { resolveOtelBackend, traceSampleRate } from "./backends"
import { scrubUrl } from "./scrub"

type RequestLike = {
    url?: string
    path?: string
}

function requestPath(request: RequestLike) {
    return request.url || request.path || ""
}

function scrubAuthRequest(span: Span, request: RequestLike) {
    const raw = requestPath(request)
    if (!raw.includes("/api/auth") && !raw.includes("/oauth2")) return
    const path = scrubUrl(raw.startsWith("/") ? raw : `/${raw}`)
    span.setAttribute("url.query", "")
    span.setAttribute("url.full", path)
    span.setAttribute("http.url", path)
    span.setAttribute("http.target", path)
}

let started = false

/** Register one Node tracer. Returns false when tracing is disabled. */
export function registerOtel() {
    if (started) return true
    const backend = resolveOtelBackend(process.env)
    if (!backend) return false
    started = true

    const exporter = new OTLPTraceExporter({
        url: backend.endpoint,
        headers: backend.headers
    })
    const provider = new NodeTracerProvider({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]:
                process.env.OTEL_SERVICE_NAME?.trim() || "better-auth-server",
            ...backend.resourceAttributes
        }),
        sampler: new ParentBasedSampler({
            root: new TraceIdRatioBasedSampler(traceSampleRate(process.env))
        }),
        spanProcessors: [new BatchSpanProcessor(exporter)]
    })
    provider.register()

    registerInstrumentations({
        instrumentations: [
            new HttpInstrumentation({
                ignoreIncomingRequestHook(request) {
                    const url = request.url ?? ""
                    return url.startsWith("/_next") || url.startsWith("/ingest")
                },
                requestHook: scrubAuthRequest,
                applyCustomAttributesOnSpan: scrubAuthRequest
            }),
            new UndiciInstrumentation(),
            new PgInstrumentation({ enhancedDatabaseReporting: false })
        ]
    })

    return true
}
