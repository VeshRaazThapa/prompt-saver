CREATE TABLE "rate_limits" (
	"token_id" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_token_id_window_start_pk" PRIMARY KEY("token_id","window_start")
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE cascade ON UPDATE no action;