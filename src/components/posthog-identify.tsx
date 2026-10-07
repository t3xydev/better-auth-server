"use client"

import { usePostHog } from "posthog-js/react"
import { useEffect, useRef } from "react"

import { authClient } from "@/lib/auth-client"

function unique(values: string[]) {
    return [...new Set(values.filter(Boolean))]
}

export function PostHogIdentify() {
    const { data: session } = authClient.useSession()
    const posthog = usePostHog()
    const identifiedUserIdRef = useRef<string | null>(null)
    const lastPropertiesRef = useRef<string | null>(null)

    useEffect(() => {
        if (!posthog) return

        const userId = session?.user?.id ?? null

        if (!userId) {
            if (identifiedUserIdRef.current) {
                posthog.capture("user_signed_out")
                posthog.reset()
                identifiedUserIdRef.current = null
                lastPropertiesRef.current = null
            }
            return
        }

        const personId = userId
        let cancelled = false

        async function syncPerson() {
            const { data } = await authClient.segments.me()
            if (cancelled || !data || !session) return

            const roles = unique([data.privilegeRole, ...data.roles])
            const properties = {
                email: session.user.email,
                name: session.user.name,
                createdAt: session.user.createdAt,
                privilege_role: data.privilegeRole,
                roles,
                groups: data.groups,
                permissions: data.permissions
            }
            const signature = JSON.stringify({
                userId: personId,
                privilege_role: data.privilegeRole,
                roles,
                groups: data.groups,
                permissions: data.permissions
            })
            const isNewIdentity = identifiedUserIdRef.current !== personId

            if (isNewIdentity || lastPropertiesRef.current !== signature) {
                posthog.identify(personId, properties)
                lastPropertiesRef.current = signature
            }

            if (isNewIdentity) {
                const event =
                    window.location.pathname === "/auth/sign-up"
                        ? "user_signed_up"
                        : "user_signed_in"
                posthog.capture(event, {
                    userId: personId,
                    email: session.user.email
                })
                identifiedUserIdRef.current = personId
            }
        }

        void syncPerson()
        return () => {
            cancelled = true
        }
    }, [session, posthog])

    return null
}
