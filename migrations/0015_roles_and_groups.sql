CREATE TABLE "segment_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "segment_roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "segment_role_members" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"group_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "segment_role_members" ADD CONSTRAINT "segment_role_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_role_members" ADD CONSTRAINT "segment_role_members_role_id_segment_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."segment_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "segmentRoleMembers_userId_roleId_uidx" ON "segment_role_members" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "segmentRoleMembers_userId_idx" ON "segment_role_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "segmentRoleMembers_roleId_idx" ON "segment_role_members" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groupMembers_userId_groupId_uidx" ON "group_members" USING btree ("user_id","group_id");--> statement-breakpoint
CREATE INDEX "groupMembers_userId_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "groupMembers_groupId_idx" ON "group_members" USING btree ("group_id");
