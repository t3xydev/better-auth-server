import { db } from "@/database/db"
import { sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Liveness / readiness probe.
 *
 * Default (Railway deploy healthcheck): always 200 once the process is serving,
 * with database status in the JSON body. Railway only accepts 2xx — a 503 on
 * transient DB blips marks the whole deploy failed.
 *
 * Optional readiness: GET /api/health?ready=1 returns 503 when the DB is down.
 */
export async function GET(request: NextRequest) {
	const requireReady = request.nextUrl.searchParams.get("ready") === "1"

	try {
		const start = Date.now()
		await db.execute(sql`SELECT 1`)
		const latency = Date.now() - start

		return NextResponse.json(
			{
				status: "healthy",
				ready: true,
				database: "connected",
				latency_ms: latency
			},
			{ status: 200 }
		)
	} catch {
		if (requireReady) {
			return NextResponse.json(
				{
					status: "unhealthy",
					ready: false,
					database: "disconnected"
				},
				{ status: 503 }
			)
		}

		// Process is up; report DB separately so deploy healthchecks stay 2xx.
		return NextResponse.json(
			{
				status: "degraded",
				ready: false,
				database: "disconnected"
			},
			{ status: 200 }
		)
	}
}
