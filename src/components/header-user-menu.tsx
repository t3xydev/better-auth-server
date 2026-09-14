"use client"

import {
    CreateOrganizationDialog,
    OrganizationCellView,
    UserButton,
    useCurrentOrganization
} from "@daveyplate/better-auth-ui"
import {
    Building2,
    Check,
    CreditCard,
    PlusCircle,
    UserRound
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { organizationsEnabled } from "@/lib/organizations"
import { billingEnabled } from "@/modules/billing"

type Organization = {
    id: string
    name: string
    slug: string
    logo?: string | null
    createdAt: Date
    metadata?: Record<string, unknown> | null
}

function HeaderUserMenuWithOrganizations() {
    const { data: session } = authClient.useSession()
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [createOpen, setCreateOpen] = useState(false)
    const { data: activeOrganization, refetch } = useCurrentOrganization()

    const loadOrganizations = useCallback(async () => {
        const { data, error } = await authClient.organization.list()
        if (error) {
            toast.error(error.message || "Failed to load organizations")
            return
        }
        setOrganizations((data as Organization[]) ?? [])
    }, [])

    useEffect(() => {
        if (!session) {
            setOrganizations([])
            return
        }
        void loadOrganizations()
    }, [loadOrganizations, session, activeOrganization?.id])

    const setActive = useCallback(
        async (organizationId: string | null) => {
            const { error } = await authClient.organization.setActive({
                organizationId
            })
            if (error) {
                toast.error(error.message || "Failed to switch organization")
                return
            }
            refetch?.()
            await loadOrganizations()
        },
        [loadOrganizations, refetch]
    )

    const additionalLinks = useMemo(() => {
        if (!session) return undefined

        return [
            <button
                key="personal"
                type="button"
                className="flex w-full cursor-default items-center gap-2"
                onClick={() => void setActive(null)}
            >
                <UserRound className="size-4 shrink-0" />
                <span className="flex-1 truncate text-left">
                    Personal account
                </span>
                {!activeOrganization && <Check className="size-4 shrink-0" />}
            </button>,
            ...organizations.map((organization) => (
                <button
                    key={organization.id}
                    type="button"
                    className="flex w-full cursor-default items-center gap-2"
                    onClick={() => void setActive(organization.id)}
                >
                    <OrganizationCellView
                        className="min-w-0 flex-1"
                        organization={organization}
                        size="sm"
                    />
                    {activeOrganization?.id === organization.id && (
                        <Check className="size-4 shrink-0" />
                    )}
                </button>
            )),
            <button
                key="create-organization"
                type="button"
                className="flex w-full cursor-default items-center gap-2"
                onClick={() => setCreateOpen(true)}
            >
                <PlusCircle className="size-4 shrink-0" />
                <span>Create organization</span>
            </button>,
            {
                href: "/account/organizations",
                label: "Manage organizations",
                icon: <Building2 className="size-4" />,
                signedIn: true,
                separator: true
            },
            ...(billingEnabled
                ? [
                      {
                          href: "/account/billing",
                          label: "Billing",
                          icon: <CreditCard className="size-4" />,
                          signedIn: true
                      }
                  ]
                : [])
        ]
    }, [session, organizations, activeOrganization, setActive])

    return (
        <>
            <UserButton
                size="icon"
                align="end"
                additionalLinks={additionalLinks}
            />
            <CreateOrganizationDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
        </>
    )
}

export function HeaderUserMenu() {
    if (!organizationsEnabled) {
        return (
            <UserButton
                size="icon"
                align="end"
                additionalLinks={
                    billingEnabled
                        ? [
                              {
                                  href: "/account/billing",
                                  label: "Billing",
                                  icon: <CreditCard className="size-4" />,
                                  signedIn: true
                              }
                          ]
                        : undefined
                }
            />
        )
    }

    return <HeaderUserMenuWithOrganizations />
}
