import { AuthMain, authSearchString } from "@/components/auth-main"

export default async function AuthIndexPage({
    searchParams
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const search = await authSearchString(searchParams)
    return <AuthMain path="sign-in" search={search} />
}
