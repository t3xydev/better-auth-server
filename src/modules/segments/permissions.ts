export const APP_PERMISSIONS = [
    {
        key: "app:access",
        label: "App access",
        description:
            "Grant for a signed-in product route. Check it with requirePermission."
    },
    {
        key: "directory:read",
        label: "Directory read",
        description:
            "Grant for listing people outside the admin panel. Check it with requirePermission."
    }
] as const

export type AppPermission = (typeof APP_PERMISSIONS)[number]["key"]

const KNOWN_PERMISSIONS = new Set<string>(
    APP_PERMISSIONS.map((permission) => permission.key)
)

export function isAppPermission(key: string): key is AppPermission {
    return KNOWN_PERMISSIONS.has(key)
}

/** Drops unknown keys and duplicates. Stored keys outside the allowlist never grant access. */
export function filterKnownPermissions(
    keys: readonly string[]
): AppPermission[] {
    const granted: AppPermission[] = []
    for (const key of keys) {
        if (!isAppPermission(key) || granted.includes(key)) continue
        granted.push(key)
    }
    return granted
}

export function unionRolePermissions(
    roles: readonly { permissions: readonly string[] | null | undefined }[]
): AppPermission[] {
    return filterKnownPermissions(
        roles.flatMap((role) => role.permissions ?? [])
    )
}

/** Rejects keys that are not in the allowlist. Used when an admin saves a role. */
export function parsePermissionKeys(keys: readonly string[]): AppPermission[] {
    const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
    const unknown = unique.filter((key) => !isAppPermission(key))
    if (unknown.length > 0) {
        throw new Error(`Unknown permission: ${unknown.join(", ")}`)
    }
    return unique as AppPermission[]
}
