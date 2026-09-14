import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { UserSegmentForm } from "@/components/admin/user-segment-form"
import { getAdminUser } from "@/lib/actions/admin-users"
import { auth } from "@/lib/auth"

export default async function AdminUserDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const detail = await getAdminUser(id)
    if (!detail) notFound()

    const session = await auth.api.getSession({ headers: await headers() })

    return (
        <UserSegmentForm
            user={detail.user}
            roles={detail.roles}
            groups={detail.groups}
            assignedRoleIds={detail.assignedRoleIds}
            assignedGroupIds={detail.assignedGroupIds}
            isSelf={session?.user.id === detail.user.id}
        />
    )
}
