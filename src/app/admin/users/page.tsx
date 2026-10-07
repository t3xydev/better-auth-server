import { UserTable } from "@/components/admin/user-table"
import { listAdminUsers } from "@/lib/actions/admin-users"

const PAGE_SIZE = 20

export default async function AdminUsersPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; page?: string }>
}) {
    const params = await searchParams
    const query = params.q?.trim() ?? ""
    const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1)
    const { users, total } = await listAdminUsers({
        search: query || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE
    })

    return (
        <UserTable
            users={users}
            total={total}
            query={query}
            page={page}
            pageSize={PAGE_SIZE}
        />
    )
}
