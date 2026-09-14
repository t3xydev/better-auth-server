import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { Separator } from "@/components/ui/separator"
import { auth } from "@/lib/auth"

export default async function AdminLayout({
    children
}: {
    children: ReactNode
}) {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user) redirect("/auth/sign-in?redirectTo=/admin")
    if (session.user.role !== "admin") redirect("/")

    return (
        <main className="container flex flex-col gap-6 self-center p-4 md:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-bold text-2xl tracking-tight">Admin</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage OAuth clients, users, roles, groups, and invites
                    </p>
                </div>
                <nav className="flex flex-wrap items-center gap-4 text-sm">
                    <Link
                        href="/admin/clients"
                        className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                        Clients
                    </Link>
                    <Link
                        href="/admin/users"
                        className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                        Users
                    </Link>
                    <Link
                        href="/admin/roles"
                        className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                        Roles
                    </Link>
                    <Link
                        href="/admin/groups"
                        className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                        Groups
                    </Link>
                    <Link
                        href="/admin/invites"
                        className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                        Invites
                    </Link>
                </nav>
            </div>
            <Separator />
            {children}
        </main>
    )
}
