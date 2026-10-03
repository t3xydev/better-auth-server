import assert from "node:assert/strict"
import { test } from "node:test"

import {
    filterKnownPermissions,
    parsePermissionKeys,
    unionRolePermissions
} from "./permissions"

test("unionRolePermissions keeps allowlisted keys and drops unknown ones", () => {
    const granted = unionRolePermissions([
        { permissions: ["app:access", "not-a-permission"] },
        { permissions: ["app:access", "directory:read"] },
        { permissions: null }
    ])
    assert.deepEqual(granted, ["app:access", "directory:read"])
})

test("filterKnownPermissions ignores privilege names", () => {
    assert.deepEqual(filterKnownPermissions(["admin", "user", "app:access"]), [
        "app:access"
    ])
})

test("parsePermissionKeys rejects keys outside the allowlist", () => {
    assert.deepEqual(parsePermissionKeys([" directory:read ", "app:access"]), [
        "directory:read",
        "app:access"
    ])
    assert.throws(
        () => parsePermissionKeys(["app:access", "billing:manage"]),
        /Unknown permission: billing:manage/
    )
})
