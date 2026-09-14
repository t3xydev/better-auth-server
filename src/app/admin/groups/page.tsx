import { CatalogTable } from "@/components/admin/catalog-table"
import { listCatalogGroups } from "@/lib/actions/admin-segments"

export default async function AdminGroupsPage() {
    const groups = await listCatalogGroups()
    return <CatalogTable kind="group" items={groups} />
}
