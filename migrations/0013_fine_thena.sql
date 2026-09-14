CREATE TABLE "oauth_client_assertions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_client_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "oauth_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" text[],
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"disabled" boolean DEFAULT false,
	"created_at" timestamp,
	"updated_at" timestamp,
	"policy_version" integer DEFAULT 1,
	"metadata" jsonb,
	CONSTRAINT "oauth_resources_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
ALTER TABLE "jwkss" ADD COLUMN "alg" text;--> statement-breakpoint
ALTER TABLE "jwkss" ADD COLUMN "crv" text;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "authorization_code_id" text;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "resources" text[];--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "requested_user_info_claims" text[];--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "revoked" timestamp;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "confirmation" jsonb;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "client_discovery_id" text;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "client_credentials_scopes" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "backchannel_logout_uri" text;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "backchannel_logout_session_required" boolean;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "application_type" text;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "jwks" text;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "jwks_uri" text;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "dpop_bound_access_tokens" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD COLUMN "resources" text[];--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD COLUMN "requested_user_info_claims" text[];--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "authorization_code_id" text;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "resources" text[];--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "requested_user_info_claims" text[];--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "rotated_at" timestamp;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "rotation_replay_response" text;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "rotation_replay_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD COLUMN "confirmation" jsonb;--> statement-breakpoint
UPDATE "oauth_clients"
SET "application_type" = CASE
	WHEN "type" = 'native' THEN 'native'
	WHEN "type" = 'web' THEN 'web'
	ELSE COALESCE("application_type", 'web')
END
WHERE "application_type" IS NULL;--> statement-breakpoint
UPDATE "oauth_clients"
SET "token_endpoint_auth_method" = 'none'
WHERE "public" IS TRUE;--> statement-breakpoint
UPDATE "oauth_clients"
SET "token_endpoint_auth_method" = COALESCE(NULLIF("token_endpoint_auth_method", ''), 'client_secret_basic')
WHERE "public" IS NOT TRUE;--> statement-breakpoint
UPDATE "oauth_clients"
SET "client_credentials_scopes" = '{}'
WHERE "client_credentials_scopes" IS NULL;--> statement-breakpoint
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_resource_id_oauth_resources_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."oauth_resources"("identifier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauthClientResources_clientId_resourceId_uidx" ON "oauth_client_resources" USING btree ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "oauthClientResources_clientId_idx" ON "oauth_client_resources" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauthClientResources_resourceId_idx" ON "oauth_client_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "oauthAccessTokens_authorizationCodeId_idx" ON "oauth_access_tokens" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "oauthRefreshTokens_authorizationCodeId_idx" ON "oauth_refresh_tokens" USING btree ("authorization_code_id");--> statement-breakpoint
INSERT INTO "oauth_client_resources" ("id", "client_id", "resource_id", "created_at")
SELECT md5(c."client_id" || ':' || r."identifier"), c."client_id", r."identifier", now()
FROM "oauth_clients" c
CROSS JOIN "oauth_resources" r
WHERE NOT EXISTS (
	SELECT 1 FROM "oauth_client_resources" x
	WHERE x."client_id" = c."client_id" AND x."resource_id" = r."identifier"
);--> statement-breakpoint
ALTER TABLE "oauth_clients" DROP COLUMN "public";--> statement-breakpoint
ALTER TABLE "oauth_clients" DROP COLUMN "type";
