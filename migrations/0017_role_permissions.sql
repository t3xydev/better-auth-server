CREATE TABLE "invite_segment_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"invite_id" text NOT NULL,
	"role_ids" text[] NOT NULL,
	"group_ids" text[] NOT NULL,
	CONSTRAINT "invite_segment_grants_invite_id_unique" UNIQUE("invite_id")
);
--> statement-breakpoint
ALTER TABLE "segment_roles" ADD COLUMN "permissions" text[];--> statement-breakpoint
ALTER TABLE "invite_segment_grants" ADD CONSTRAINT "invite_segment_grants_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE cascade ON UPDATE no action;