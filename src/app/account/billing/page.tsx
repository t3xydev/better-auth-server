import Link from "next/link"
import { notFound } from "next/navigation"
import { billingEnabled } from "@/modules/billing"
import { BillingView } from "@/modules/billing/billing-view"

export default function BillingAccountPage() {
    if (!billingEnabled) notFound()

    return (
        <main className="container self-center p-4 md:p-6">
            <div className="mx-auto flex max-w-lg flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                    <h1 className="font-semibold text-lg md:text-xl">
                        Billing
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Subscribe on this account. Client apps can read whether
                        your subscription is active; they never see payment
                        details.
                    </p>
                </div>
                <BillingView />
                <Link
                    className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                    href="/account/settings"
                >
                    Back to settings
                </Link>
            </div>
        </main>
    )
}
