import { AsyncLocalStorage } from "node:async_hooks"

type PendingInviteGrants = {
    roleIds: string[]
    groupIds: string[]
}

const pendingInviteGrants = new AsyncLocalStorage<PendingInviteGrants>()

export function runWithInviteGrants<T>(
    grants: PendingInviteGrants,
    fn: () => Promise<T>
) {
    return pendingInviteGrants.run(grants, fn)
}

export function currentInviteGrants() {
    return pendingInviteGrants.getStore()
}
