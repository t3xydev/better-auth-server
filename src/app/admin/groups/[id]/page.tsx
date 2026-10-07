import { notFound } from "next/navigation"
import { CatalogDetail } from "@/components/admin/catalog-detail"
import {
    getCatalogGroup,
    listCatalogGroupMembers
} from "@/lib/actions/admin-segments"

export default async function AdminGroupDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const group = await getCatalogGroup(id)
    if (!group) notFound()
    const members = await listCatalogGroupMembers(id)
    return <CatalogDetail kind="group" item={group} members={members} />
}
