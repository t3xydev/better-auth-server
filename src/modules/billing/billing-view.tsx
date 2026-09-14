"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import type {
    BillingCatalog,
    BillingEntitlement,
    BillingSubscription
} from "@/modules/billing"

type BillingResponse = {
    enabled: boolean
    configured: boolean
    catalog: BillingCatalog
    subscription: BillingSubscription | null
    entitlements: BillingEntitlement[]
}

function statusLabel(status: string) {
    switch (status) {
        case "active":
            return "Active"
        case "trialing":
            return "Trial"
        case "past_due":
            return "Past due"
        case "canceled":
            return "Canceled"
        case "grace":
            return "Grace period"
        default:
            return status.replaceAll("_", " ")
    }
}

function formatDate(value: string | null) {
    if (!value) return null
    return new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    })
}

function intervalLabel(interval: string) {
    return interval === "yearly" ? "Yearly" : "Monthly"
}

export function BillingView() {
    const [data, setData] = useState<BillingResponse | null>(null)
    const [pendingKey, setPendingKey] = useState<string | null>(null)

    const load = useCallback(async () => {
        const { data: payload, error } = await authClient.billing.subscription()
        if (error) {
            toast.error(error.message || "Failed to load billing")
            return
        }
        setData(payload as BillingResponse)
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const entitled = useMemo(
        () =>
            (data?.entitlements ?? []).filter(
                (item) => item.status === "active" || item.status === "grace"
            ),
        [data]
    )

    async function startCheckout(priceKey: string) {
        if (!data?.configured) {
            toast.error("Add Stripe keys and Price IDs to enable checkout.")
            return
        }
        setPendingKey(priceKey)
        try {
            const { data: payload, error } = await authClient.billing.checkout({
                priceKey
            })
            if (error) {
                toast.error(error.message || "Unable to start checkout")
                return
            }
            const url = (payload as { url?: string } | null)?.url
            if (!url) {
                toast.error("Checkout did not return a URL")
                return
            }
            window.location.assign(url)
        } finally {
            setPendingKey(null)
        }
    }

    async function openPortal() {
        if (!data?.configured) {
            toast.error("Add Stripe keys to open the billing portal.")
            return
        }
        setPendingKey("portal")
        try {
            const { data: payload, error } = await authClient.billing.portal()
            if (error) {
                toast.error(error.message || "Unable to open billing portal")
                return
            }
            const url = (payload as { url?: string } | null)?.url
            if (!url) {
                toast.error("Portal did not return a URL")
                return
            }
            window.location.assign(url)
        } finally {
            setPendingKey(null)
        }
    }

    if (!data) {
        return <p className="text-muted-foreground text-sm">Loading billing…</p>
    }

    const checkoutReady = data.configured
    const subscription = data.subscription
    const hasOpenSubscription = Boolean(subscription)
    const placeholderNote = data.catalog.placeholders
        ? "Development placeholders — add Stripe keys and Price IDs to enable checkout."
        : !checkoutReady
          ? "Add Stripe keys and Price IDs to enable checkout."
          : null

    return (
        <div className="flex flex-col gap-6">
            {placeholderNote ? (
                <p className="text-muted-foreground text-sm">
                    {placeholderNote}
                </p>
            ) : null}
            <Card>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>
                        Your plan lives on this account. Other apps can check
                        entitlements; they cannot charge you.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {subscription ? (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium capitalize">
                                    {subscription.productKey}
                                </span>
                                <Badge
                                    variant={
                                        subscription.status === "active" ||
                                        subscription.status === "trialing"
                                            ? "default"
                                            : "secondary"
                                    }
                                >
                                    {statusLabel(subscription.status)}
                                </Badge>
                            </div>
                            {subscription.currentPeriodEnd && (
                                <p className="text-muted-foreground text-sm">
                                    {subscription.cancelAtPeriodEnd
                                        ? `Ends ${formatDate(subscription.currentPeriodEnd)}`
                                        : `Renews ${formatDate(subscription.currentPeriodEnd)}`}
                                </p>
                            )}
                            {entitled.length > 0 && (
                                <p className="text-sm">
                                    Entitlements:{" "}
                                    {entitled
                                        .map((item) => item.key)
                                        .join(", ")}
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            No active subscription.
                        </p>
                    )}
                </CardContent>
                {hasOpenSubscription && (
                    <CardFooter>
                        <Button
                            variant="outline"
                            disabled={pendingKey === "portal" || !checkoutReady}
                            onClick={() => void openPortal()}
                        >
                            {pendingKey === "portal"
                                ? "Opening…"
                                : "Manage billing"}
                        </Button>
                    </CardFooter>
                )}
            </Card>

            {!hasOpenSubscription &&
                data.catalog.products.map((product) => (
                    <Card key={product.key}>
                        <CardHeader>
                            <CardTitle>{product.name}</CardTitle>
                            <CardDescription>
                                {product.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            {data.catalog.trialDays ? (
                                <p className="text-muted-foreground text-sm">
                                    {data.catalog.trialDays}-day trial on first
                                    subscribe.
                                </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                {product.prices.map((price) => (
                                    <Button
                                        key={price.key}
                                        disabled={
                                            pendingKey === price.key ||
                                            !checkoutReady
                                        }
                                        onClick={() =>
                                            void startCheckout(price.key)
                                        }
                                    >
                                        {pendingKey === price.key
                                            ? "Redirecting…"
                                            : `Subscribe ${intervalLabel(price.interval)}`}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
        </div>
    )
}
