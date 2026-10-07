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
    BillingManageMode,
    BillingProcessorId,
    BillingSubscription
} from "@/modules/billing"
import { parseProcessorId } from "@/modules/billing"

const PROCESSOR_STORAGE_KEY = "billing-processor"

type BillingResponse = {
    enabled: boolean
    configured: boolean
    catalog: BillingCatalog
    subscription: BillingSubscription | null
    entitlements: BillingEntitlement[]
    manageMode: BillingManageMode | null
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

function methodLabel(id: BillingProcessorId) {
    return id === "zoneless" ? "USDC" : "Card"
}

function readStoredProvider() {
    if (typeof window === "undefined") return null
    return parseProcessorId(window.localStorage.getItem(PROCESSOR_STORAGE_KEY))
}

export function BillingView() {
    const [data, setData] = useState<BillingResponse | null>(null)
    const [pendingKey, setPendingKey] = useState<string | null>(null)
    const [provider, setProvider] = useState<BillingProcessorId | null>(null)

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

    useEffect(() => {
        if (!data) return
        const methods = data.catalog.methods
        const stored = readStoredProvider()
        const next =
            (stored && methods.some((method) => method.id === stored)
                ? stored
                : null) ??
            (methods.some(
                (method) => method.id === data.catalog.defaultProvider
            )
                ? data.catalog.defaultProvider
                : methods[0]?.id) ??
            "stripe"
        setProvider(next)
    }, [data])

    function chooseProvider(id: BillingProcessorId) {
        setProvider(id)
        window.localStorage.setItem(PROCESSOR_STORAGE_KEY, id)
    }

    const entitled = useMemo(
        () =>
            (data?.entitlements ?? []).filter(
                (item) => item.status === "active" || item.status === "grace"
            ),
        [data]
    )

    const selectedMethod = data?.catalog.methods.find(
        (method) => method.id === provider
    )
    const checkoutReady = Boolean(
        selectedMethod && (selectedMethod.configured || selectedMethod.mock)
    )
    const showMethodToggle = (data?.catalog.methods.length ?? 0) > 1

    async function startCheckout(priceKey: string) {
        if (!provider || !checkoutReady) {
            toast.error("Choose a payment method that is available.")
            return
        }
        setPendingKey(priceKey)
        try {
            const { data: payload, error } = await authClient.billing.checkout({
                priceKey,
                provider
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

    async function cancelSubscription(atPeriodEnd: boolean) {
        setPendingKey(atPeriodEnd ? "cancel-end" : "cancel-now")
        try {
            const { error } = await authClient.billing.cancel({
                atPeriodEnd
            })
            if (error) {
                toast.error(error.message || "Unable to cancel subscription")
                return
            }
            toast.success(
                atPeriodEnd
                    ? "Cancellation scheduled at period end"
                    : "Subscription canceled"
            )
            await load()
        } finally {
            setPendingKey(null)
        }
    }

    if (!data || !provider) {
        return <p className="text-muted-foreground text-sm">Loading billing…</p>
    }

    const subscription = data.subscription
    const hasOpenSubscription = Boolean(subscription)
    const mockSelected = Boolean(selectedMethod?.mock)
    const placeholderNote = mockSelected
        ? "Development mock — checkout grants a local subscription until processor keys are set."
        : data.catalog.placeholders
          ? "Development placeholders — add processor keys and Price IDs to enable hosted checkout."
          : !data.configured && !checkoutReady
            ? "Add processor keys and Price IDs to enable checkout."
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
                                <Badge variant="outline">
                                    {methodLabel(subscription.provider)}
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
                {hasOpenSubscription && data.manageMode === "portal" && (
                    <CardFooter>
                        <Button
                            variant="outline"
                            disabled={pendingKey === "portal"}
                            onClick={() => void openPortal()}
                        >
                            {pendingKey === "portal"
                                ? "Opening…"
                                : "Manage billing"}
                        </Button>
                    </CardFooter>
                )}
                {hasOpenSubscription && data.manageMode === "cancel" && (
                    <CardFooter className="flex flex-wrap gap-2">
                        {!subscription?.cancelAtPeriodEnd ? (
                            <Button
                                variant="outline"
                                disabled={pendingKey === "cancel-end"}
                                onClick={() => void cancelSubscription(true)}
                            >
                                {pendingKey === "cancel-end"
                                    ? "Canceling…"
                                    : "Cancel at period end"}
                            </Button>
                        ) : null}
                        <Button
                            variant="ghost"
                            disabled={pendingKey === "cancel-now"}
                            onClick={() => void cancelSubscription(false)}
                        >
                            {pendingKey === "cancel-now"
                                ? "Canceling…"
                                : "Cancel now"}
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
                            {showMethodToggle ? (
                                <div className="flex flex-col gap-2">
                                    <p className="text-muted-foreground text-sm">
                                        Payment method
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {data.catalog.methods.map((method) => (
                                            <Button
                                                key={method.id}
                                                type="button"
                                                size="sm"
                                                variant={
                                                    provider === method.id
                                                        ? "default"
                                                        : "outline"
                                                }
                                                onClick={() =>
                                                    chooseProvider(method.id)
                                                }
                                            >
                                                {method.label}
                                                {method.mock ? " (mock)" : ""}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
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
