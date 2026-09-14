import { CatalogTable } from "@/components/admin/catalog-table"
import { listCatalogRoles } from "@/lib/actions/admin-segments"

export default async function AdminRolesPage() {
    const roles = await listCatalogRoles()
    return <CatalogTable kind="role" items={roles} />
}
