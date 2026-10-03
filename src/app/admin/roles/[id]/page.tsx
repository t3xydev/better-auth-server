import { notFound } from "next/navigation"
import { CatalogDetail } from "@/components/admin/catalog-detail"
import {
    getCatalogRole,
    listCatalogRoleMembers
} from "@/lib/actions/admin-segments"

export default async function AdminRoleDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const role = await getCatalogRole(id)
    if (!role) notFound()
    const members = await listCatalogRoleMembers(id)
    return <CatalogDetail kind="role" item={role} members={members} />
}
