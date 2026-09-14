"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import type { AdminUserRow } from "@/lib/actions/admin-users"

export function UserTable({
    users,
    total,
    query,
    page,
    pageSize
}: {
    users: AdminUserRow[]
    total: number
    query: string
    page: number
    pageSize: number
}) {
    const router = useRouter()
    const [search, setSearch] = useState(query)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    function submitSearch(event: FormEvent) {
        event.preventDefault()
        const params = new URLSearchParams()
        if (search.trim()) params.set("q", search.trim())
        router.push(
            params.size > 0
                ? `/admin/users?${params.toString()}`
                : "/admin/users"
        )
    }

    function pageHref(nextPage: number) {
        const params = new URLSearchParams()
        if (query) params.set("q", query)
        if (nextPage > 1) params.set("page", String(nextPage))
        const qs = params.toString()
        return qs ? `/admin/users?${qs}` : "/admin/users"
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-semibold text-xl tracking-tight">
                        Users
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {total} {total === 1 ? "user" : "users"}
                    </p>
                </div>
                <form onSubmit={submitSearch} className="flex gap-2">
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or email"
                        className="w-64"
                    />
                    <Button type="submit" variant="outline">
                        Search
                    </Button>
                </form>
            </div>

            {users.length === 0 ? (
                <p className="text-muted-foreground text-sm">No users found.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Privilege</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Link
                                        href={`/admin/users/${user.id}`}
                                        className="font-medium hover:underline"
                                    >
                                        {user.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            user.role === "admin"
                                                ? "default"
                                                : "outline"
                                        }
                                    >
                                        {user.role || "user"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {new Date(
                                        user.createdAt
                                    ).toLocaleDateString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={page <= 1}
                        >
                            <Link href={pageHref(page - 1)}>Previous</Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={page >= totalPages}
                        >
                            <Link href={pageHref(page + 1)}>Next</Link>
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
