import Link from "next/link"

const appName = process.env.APPLICATION_NAME || "Better Auth Server"

export default async function AuthErrorPage({
    searchParams
}: {
    searchParams: Promise<{ error?: string; error_description?: string }>
}) {
    const { error, error_description } = await searchParams
    const code = error?.trim() || "unknown_error"
    const description = error_description?.trim()

    return (
        <main className="container flex w-full grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
            <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
                <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">{appName}</p>
                    <h1 className="font-semibold text-xl">
                        Sign-in could not be completed
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        The authorization request failed. You can return to sign
                        in and try again.
                    </p>
                </div>
                <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
                    <p>{code}</p>
                    {description ? (
                        <p className="mt-1 text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
                <Link
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm"
                    href="/auth/sign-in"
                >
                    Back to sign in
                </Link>
            </div>
        </main>
    )
}
