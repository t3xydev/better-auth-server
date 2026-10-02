CREATE TABLE "billing_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_customers" DROP CONSTRAINT "billing_customers_user_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "billingWebhookEvent_provider_eventId_uidx" ON "billing_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billingCustomer_userId_provider_uidx" ON "billing_customers" USING btree ("user_id","provider");