import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { ActivateInviteClient } from "@/components/activate-invite-client"
import { InviteSignUpButton } from "@/components/invite-sign-up-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { auth } from "@/lib/auth"
import { inviteOnly } from "@/lib/invite-only"
import { getInviteWelcome } from "@/lib/invite-welcome"

const appName = process.env.APPLICATION_NAME || "Better Auth Server"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ token: string }>
}): Promise<Metadata> {
    const { token } = await params
    const invite = await getInviteWelcome(token)

    if (!invite || invite.status !== "pending" || invite.isExpired) {
        return {
            title: `Invite · ${appName}`,
            description: `You've been invited to join ${appName}.`,
        }
    }

    const from = invite.inviterName ? ` from ${invite.inviterName}` : ""
    return {
        title: `You're invited · ${appName}`,
        description: `Join ${appName}${from} with the "${invite.role}" role.`,
    }
}

function formatExpiry(date: Date) {
    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    })
}

export default async function InviteWelcomePage({
    params,
}: {
    params: Promise<{ token: string }>
}) {
    const { token } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    const invite = await getInviteWelcome(token)

    if (!invite) {
        return (
            <main className="container flex grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <p className="text-sm font-medium text-muted-foreground">{appName}</p>
                        <CardTitle>Invite not found</CardTitle>
                        <CardDescription>
                            This invite link is invalid or no longer exists.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button asChild className="w-full" variant="outline">
                            <Link href="/">Go home</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        )
    }

    const isActionable = invite.status === "pending" && !invite.isExpired
    const invitedEmails = invite.emails.length > 0 ? invite.emails : invite.email ? [invite.email] : []
    const sessionEmail = session?.user?.email
    const emailMismatch =
        Boolean(sessionEmail) &&
        invite.isPrivate &&
        !invitedEmails.includes(sessionEmail!)

    const signInHref = `/auth/sign-in?redirectTo=${encodeURIComponent(`/invite/activate/${token}`)}`
    const signUpHref = `/auth/sign-up?redirectTo=${encodeURIComponent(`/invite/activate/${token}`)}`

    return (
        <main className="container flex grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-3">
                    <p className="text-sm font-medium tracking-wide text-muted-foreground">
                        {appName}
                    </p>
                    <CardTitle className="text-2xl">You&apos;re invited</CardTitle>
                    <CardDescription className="text-base text-pretty">
                        {invite.inviterName
                            ? `${invite.inviterName} invited you to join ${appName}.`
                            : `You've been invited to join ${appName}.`}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <dl className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Role</dt>
                            <dd>
                                <Badge variant="secondary">{invite.role}</Badge>
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Access</dt>
                            <dd className="text-right font-medium">
                                {invite.isPrivate ? "Private invite" : "Public invite"}
                            </dd>
                        </div>
                        {invite.isPrivate && invitedEmails.length > 0 ? (
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">For</dt>
                                <dd className="text-right font-medium break-all">
                                    {invitedEmails.join(", ")}
                                </dd>
                            </div>
                        ) : null}
                        {invite.newAccount != null ? (
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Account</dt>
                                <dd className="text-right font-medium">
                                    {invite.newAccount
                                        ? "New account invited"
                                        : "Existing account upgrade"}
                                </dd>
                            </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Expires</dt>
                            <dd className="text-right font-medium">
                                {formatExpiry(invite.expiresAt)}
                            </dd>
                        </div>
                        {invite.maxUses > 1 ? (
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Uses</dt>
                                <dd className="text-right font-medium">
                                    Up to {invite.maxUses}
                                </dd>
                            </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">Status</dt>
                            <dd>
                                <Badge
                                    variant={
                                        !isActionable
                                            ? "destructive"
                                            : "default"
                                    }
                                >
                                    {invite.isExpired && invite.status === "pending"
                                        ? "expired"
                                        : invite.status}
                                </Badge>
                            </dd>
                        </div>
                    </dl>

                    <Separator />

                    {!isActionable ? (
                        <p className="text-sm text-muted-foreground">
                            This invite can no longer be accepted.
                        </p>
                    ) : emailMismatch ? (
                        <p className="text-sm text-muted-foreground">
                            You&apos;re signed in as{" "}
                            <span className="font-medium text-foreground">
                                {sessionEmail}
                            </span>
                            , but this invite is for a different address. Sign out
                            and continue with the invited account.
                        </p>
                    ) : !session?.user ? (
                        <p className="text-sm text-muted-foreground">
                            {invite.newAccount
                                ? inviteOnly
                                    ? "Create an account with this invite, or sign in if you already have one."
                                    : "Create an account or sign in to accept this invite."
                                : "Sign in to accept this invite and continue."}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Signed in as{" "}
                            <span className="font-medium text-foreground">
                                {session.user.email}
                            </span>
                            . Accept to join {appName}
                            {invite.isPrivate
                                ? ", or reject this invite."
                                : ", or decline to leave without joining."}
                        </p>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                    {!isActionable ? (
                        <Button asChild className="w-full" variant="outline">
                            <Link href="/">Go home</Link>
                        </Button>
                    ) : emailMismatch ? (
                        <Button asChild className="w-full">
                            <Link href="/auth/sign-out">Sign out</Link>
                        </Button>
                    ) : !session?.user ? (
                        <>
                            <Button asChild className="w-full">
                                <Link href={signInHref}>Continue to sign in</Link>
                            </Button>
                            {invite.newAccount !== false ? (
                                inviteOnly ? (
                                    <InviteSignUpButton token={token} />
                                ) : (
                                    <Button asChild className="w-full" variant="outline">
                                        <Link href={signUpHref}>Create an account</Link>
                                    </Button>
                                )
                            ) : null}
                        </>
                    ) : (
                        <>
                            <ActivateInviteClient
                                token={token}
                                isPrivate={invite.isPrivate}
                            />
                            <p className="text-center text-xs text-muted-foreground">
                                Not you?{" "}
                                <Link href="/auth/sign-out" className="underline">
                                    Sign out
                                </Link>
                            </p>
                        </>
                    )}
                </CardFooter>
            </Card>
        </main>
    )
}
