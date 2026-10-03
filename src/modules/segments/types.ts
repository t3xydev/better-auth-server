export type PrivilegeRole = "admin" | "user"

export type SegmentCatalogItem = {
    id: string
    slug: string
    name: string
    description: string | null
    /** Allowlisted permission keys. Always empty for groups. */
    permissions: string[]
    memberCount: number
    createdAt: Date
    updatedAt: Date
}

export type SegmentMember = {
    id: string
    name: string
    email: string
}

export type UserSegments = {
    privilegeRole: PrivilegeRole
    roles: string[]
    groups: string[]
    permissions: string[]
}

export type SegmentClaims = {
    roles: string[]
    groups: string[]
    permissions: string[]
}
