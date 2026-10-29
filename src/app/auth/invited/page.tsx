import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { auth } from "@/lib/auth"

export default async function InvitedPage() {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user) {
        redirect("/auth?redirectTo=/auth/invited")
    }

    return (
        <main className="container flex grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Invite accepted</CardTitle>
                    <CardDescription>
                        Your account is ready
                        {session.user.role ? (
                            <>
                                {" "}
                                with the role{" "}
                                <span className="font-medium text-foreground">
                                    {session.user.role}
                                </span>
                            </>
                        ) : null}
                        .
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <Link href="/account/settings">Go to account settings</Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    )
}
