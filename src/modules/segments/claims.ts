import { parsePrivilegeRoles, uniqueSlugs } from "./slugs"
import type { SegmentClaims } from "./types"

export async function segmentClaimsForUser(
    user?: { id?: string; role?: string | null } | null
): Promise<Partial<SegmentClaims>> {
    if (!user?.id) return {}
    try {
        const { getUserSegments } = await import("./store")
        const segments = await getUserSegments(user.id, user.role)
        return {
            roles: uniqueSlugs(parsePrivilegeRoles(user.role), segments.roles),
            groups: segments.groups,
            permissions: segments.permissions
        }
    } catch {
        const roles = parsePrivilegeRoles(user.role)
        return user.role || roles.length > 0 ? { roles } : {}
    }
}
