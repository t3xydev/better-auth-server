export type PrivilegeRole = "admin" | "user"

export type SegmentCatalogItem = {
    id: string
    slug: string
    name: string
    description: string | null
    memberCount: number
    createdAt: Date
    updatedAt: Date
}

export type UserSegments = {
    privilegeRole: PrivilegeRole
    roles: string[]
    groups: string[]
}

export type SegmentClaims = {
    roles: string[]
    groups: string[]
}
