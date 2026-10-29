import assert from "node:assert/strict"
import { test } from "node:test"

import { emailCodeSignInAllowed } from "./email-code-account"

test("existing accounts can always use an email code", () => {
    assert.equal(
        emailCodeSignInAllowed({
            userExists: true,
            inviteOnly: true,
            inviteUsable: false,
            isBootstrap: false
        }),
        true
    )
})

test("open registration can create an account from an email code", () => {
    assert.equal(
        emailCodeSignInAllowed({
            userExists: false,
            inviteOnly: false,
            inviteUsable: false,
            isBootstrap: false
        }),
        true
    )
})

test("invite-only creation needs a usable invite or the first user", () => {
    assert.equal(
        emailCodeSignInAllowed({
            userExists: false,
            inviteOnly: true,
            inviteUsable: true,
            isBootstrap: false
        }),
        true
    )
    assert.equal(
        emailCodeSignInAllowed({
            userExists: false,
            inviteOnly: true,
            inviteUsable: false,
            isBootstrap: true
        }),
        true
    )
    assert.equal(
        emailCodeSignInAllowed({
            userExists: false,
            inviteOnly: true,
            inviteUsable: false,
            isBootstrap: false
        }),
        false
    )
})
