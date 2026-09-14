import type { PrivilegeRole } from "./types"

export const RESERVED_SLUGS = ["admin", "user"] as const

export const SLUG_PATTERN = /^[a-z][a-z0-9-]{0,62}$/

export function parsePrivilegeRoles(role: string | null | undefined): string[] {
    if (!role?.trim()) return ["user"]
    const parts = [
        ...new Set(
            role
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
        )
    ]
    return parts.length > 0 ? parts : ["user"]
}

export function privilegeRoleOf(
    role: string | null | undefined
): PrivilegeRole {
    return parsePrivilegeRoles(role).includes("admin") ? "admin" : "user"
}

export function validateCatalogSlug(slug: string): string {
    const normalized = slug.trim().toLowerCase()
    if (!SLUG_PATTERN.test(normalized)) {
        throw new Error(
            "Slug must be lowercase kebab-case, start with a letter, and be at most 63 characters."
        )
    }
    if ((RESERVED_SLUGS as readonly string[]).includes(normalized)) {
        throw new Error(`Slug "${normalized}" is reserved for IdP privilege.`)
    }
    return normalized
}

export function uniqueSlugs(...groups: string[][]): string[] {
    return [...new Set(groups.flat().filter(Boolean))]
}
