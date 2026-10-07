const AUTH_BASE = "/api/auth"

export type LinkedNostrKey = {
    publicKey: string
    createdAt: string | null
}

function getLinkUrl() {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return `${origin}${AUTH_BASE}/nostr/link`
}

async function readErrorMessage(response: Response, fallback: string) {
    const err = (await response.json().catch(() => null)) as {
        message?: string
    } | null
    return err?.message || fallback
}

async function getPublicKeyFromExtension(): Promise<string> {
    if (typeof window === "undefined" || !window.nostr) {
        throw new Error("Nostr extension not found")
    }
    return window.nostr.getPublicKey()
}

async function signTokenWithExtension(
    url: string,
    payload: Record<string, unknown>
): Promise<string> {
    const { getToken } = await import("nostr-tools/nip98")
    if (!window.nostr) throw new Error("Nostr extension not found")
    const sign = window.nostr.signEvent.bind(window.nostr)
    return getToken(url, "post", (e) => sign(e), true, payload)
}

export async function listNostrKeys(): Promise<LinkedNostrKey[]> {
    const response = await fetch(`${AUTH_BASE}/nostr/keys`, {
        credentials: "include"
    })
    if (!response.ok) {
        throw new Error(
            await readErrorMessage(response, "Failed to load Nostr keys")
        )
    }
    const payload = (await response.json()) as { keys?: LinkedNostrKey[] }
    return payload.keys ?? []
}

export async function linkNostrKey(): Promise<{ publicKey: string }> {
    const publicKey = await getPublicKeyFromExtension()

    const nonceResponse = await fetch(`${AUTH_BASE}/nostr/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ publicKey })
    })
    if (!nonceResponse.ok) {
        throw new Error("Failed to fetch nonce")
    }
    const { nonce } = (await nonceResponse.json()) as { nonce: string }

    const linkUrl = getLinkUrl()
    const token = await signTokenWithExtension(linkUrl, { nonce })

    const linkResponse = await fetch(`${AUTH_BASE}/nostr/link`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: token
        },
        credentials: "include",
        body: JSON.stringify({ nonce })
    })

    if (!linkResponse.ok) {
        throw new Error(
            await readErrorMessage(linkResponse, "Failed to link Nostr key")
        )
    }

    return (await linkResponse.json()) as { publicKey: string }
}

export async function unlinkNostrKey(publicKey: string): Promise<void> {
    const response = await fetch(`${AUTH_BASE}/nostr/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ publicKey })
    })
    if (!response.ok) {
        throw new Error(
            await readErrorMessage(response, "Failed to unlink Nostr key")
        )
    }
}
