import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { billingEnabled, getPublishableCatalog } from "@/modules/billing"

export default function PricingPage() {
    if (!billingEnabled) notFound()

    const catalog = getPublishableCatalog()

    return (
        <main className="container mx-auto flex max-w-3xl flex-col gap-8 p-4 py-12 md:p-6">
            <div className="flex flex-col gap-2">
                <h1 className="font-semibold text-3xl tracking-tight">
                    Pricing
                </h1>
                <p className="max-w-xl text-muted-foreground text-sm">
                    Plans are billed on your identity account. Subscribe once,
                    then any connected app can check your active entitlements.
                </p>
            </div>

            {catalog.placeholders ? (
                <p className="text-muted-foreground text-sm">
                    Showing catalog placeholders. Checkout needs Stripe keys and
                    Price IDs.
                </p>
            ) : null}

            {catalog.products.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No plans are configured yet.
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {catalog.products.map((product) => (
                        <Card key={product.key}>
                            <CardHeader>
                                <CardTitle>{product.name}</CardTitle>
                                <CardDescription>
                                    {product.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-muted-foreground text-sm">
                                {product.prices
                                    .map((price) =>
                                        price.interval === "yearly"
                                            ? "Yearly"
                                            : "Monthly"
                                    )
                                    .join(" or ")}
                                {catalog.trialDays
                                    ? ` · ${catalog.trialDays}-day trial`
                                    : null}
                            </CardContent>
                            <CardFooter>
                                <Button asChild>
                                    <Link href="/account/billing">
                                        Manage subscription
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </main>
    )
}
