import { CreateInviteDialog } from "@/components/admin/create-invite-dialog"
import { InviteTable } from "@/components/admin/invite-table"
import { listInvites } from "@/lib/actions/admin-invites"
import {
    listCatalogGroups,
    listCatalogRoles
} from "@/lib/actions/admin-segments"

const inviteBaseUrl = (
    process.env.BETTER_AUTH_URL || "http://localhost:3000"
).replace(/\/$/, "")

export default async function InvitesPage() {
    const [invites, roles, groups] = await Promise.all([
        listInvites(),
        listCatalogRoles(),
        listCatalogGroups()
    ])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-xl tracking-tight">
                        Invites
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {invites.length}{" "}
                        {invites.length === 1 ? "invite" : "invites"}
                    </p>
                </div>
                <CreateInviteDialog roles={roles} groups={groups} />
            </div>
            <InviteTable invites={invites} inviteBaseUrl={inviteBaseUrl} />
        </div>
    )
}
