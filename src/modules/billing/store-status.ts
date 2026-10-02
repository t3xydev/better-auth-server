import type { EntitlementStatus } from "./types"

export function mapEntitlementStatus(
    status: string,
    currentPeriodEnd: Date | null,
    now = new Date()
): EntitlementStatus {
    if (status === "trialing" || status === "active") return "active"
    if (status === "past_due") return "grace"
    if (
        status === "canceled" &&
        currentPeriodEnd &&
        currentPeriodEnd.getTime() > now.getTime()
    ) {
        return "active"
    }
    return "expired"
}
