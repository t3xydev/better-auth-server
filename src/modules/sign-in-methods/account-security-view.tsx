"use client"

import {
    AuthUIContext,
    SecuritySettingsCards,
    useAuthenticate
} from "@daveyplate/better-auth-ui"
import type { AccountViewPath } from "@daveyplate/better-auth-ui/server"
import { useContext } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { SignInMethodsCard } from "./sign-in-methods-card"

const accountClassNames = {
    sidebar: {
        base: "sticky top-20"
    }
}

export function AccountSecurityView() {
    const {
        apiKey,
        localization,
        organization,
        account: accountOptions,
        Link
    } = useContext(AuthUIContext)

    useAuthenticate()

    if (!accountOptions) return null

    const view = "SECURITY" satisfies AccountViewPath
    const navItems: { view: AccountViewPath; label: string }[] = [
        { view: "SETTINGS", label: localization.ACCOUNT },
        { view: "SECURITY", label: localization.SECURITY }
    ]

    if (apiKey) {
        navItems.push({
            view: "API_KEYS",
            label: localization.API_KEYS
        })
    }

    if (organization) {
        navItems.push({
            view: "ORGANIZATIONS",
            label: localization.ORGANIZATIONS
        })
    }

    return (
        <div className="flex w-full grow flex-col gap-4 md:flex-row md:gap-12">
            <div className="flex flex-wrap items-center justify-between gap-2 md:hidden">
                <Label className="font-semibold text-base">
                    {localization.SECURITY}
                </Label>
                <div className="flex flex-wrap gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.view}
                            href={`${accountOptions.basePath}/${accountOptions.viewPaths[item.view]}`}
                        >
                            <Button
                                size="sm"
                                className={cn(
                                    view === item.view
                                        ? "font-semibold"
                                        : "text-foreground/70"
                                )}
                                variant="ghost"
                            >
                                {item.label}
                            </Button>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="hidden md:block">
                <div
                    className={cn(
                        "flex w-48 flex-col gap-1 lg:w-60",
                        accountClassNames.sidebar.base
                    )}
                >
                    {navItems.map((item) => (
                        <Link
                            key={item.view}
                            href={`${accountOptions.basePath}/${accountOptions.viewPaths[item.view]}`}
                        >
                            <Button
                                size="lg"
                                className={cn(
                                    "w-full justify-start px-4 transition-none",
                                    view === item.view
                                        ? "font-semibold"
                                        : "text-foreground/70"
                                )}
                                variant="ghost"
                            >
                                {item.label}
                            </Button>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="flex w-full flex-col gap-4 md:gap-6">
                <SignInMethodsCard />
                <SecuritySettingsCards localization={localization} />
            </div>
        </div>
    )
}
