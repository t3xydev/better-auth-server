import type { BillingProcessorId } from "./types"

export type CheckoutInput = {
    userId: string
    email: string
    name?: string | null
    priceKey: string
    headers?: Headers
}

export type PortalInput = {
    userId: string
    headers?: Headers
}

export type BillingProcessor = {
    id: BillingProcessorId
    label: string
    configured: () => boolean
    createCheckoutUrl: (input: CheckoutInput) => Promise<string>
    createPortalUrl?: (input: PortalInput) => Promise<string>
    cancel?: (input: { userId: string; atPeriodEnd: boolean }) => Promise<void>
}

export async function resolveProcessor(id: BillingProcessorId) {
    const { processorConfigured, processorLabel, billingDevPlaceholders } =
        await import("./enabled")
    if (processorConfigured(id)) {
        if (id === "stripe") {
            const { stripeProcessor } = await import("./processors/stripe")
            return stripeProcessor
        }
        const { zonelessProcessor } = await import("./processors/zoneless")
        return zonelessProcessor
    }
    if (billingDevPlaceholders) {
        const { createMockProcessor } = await import("./processors/mock")
        return createMockProcessor(id)
    }
    throw new Error(`${processorLabel(id)} billing is not configured`)
}

export async function resolveProcessorForSubscription(input: {
    provider: string
    providerSubscriptionId: string
}) {
    const { isMockProviderId, parseProcessorId, processorLabel } = await import(
        "./enabled"
    )
    const id = parseProcessorId(input.provider)
    if (!id) {
        throw new Error("Unknown billing provider")
    }
    if (isMockProviderId(input.providerSubscriptionId)) {
        const { createMockProcessor } = await import("./processors/mock")
        return createMockProcessor(id)
    }
    try {
        return await resolveProcessor(id)
    } catch {
        throw new Error(`${processorLabel(id)} billing is not configured`)
    }
}
