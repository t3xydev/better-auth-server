DO $$
DECLARE
	updated_clients integer;
BEGIN
	UPDATE "oauth_clients"
	SET
		"enable_end_session" = true,
		"post_logout_redirect_uris" = ARRAY(
			SELECT DISTINCT redirect_uri
			FROM unnest(
				COALESCE("post_logout_redirect_uris", ARRAY[]::text[])
				|| ARRAY[
					'xyz.grape.os.system:/oauth2redirect',
					'xyz.grape.os.system.dev:/oauth2redirect'
				]::text[]
			) AS redirect(redirect_uri)
		),
		"updated_at" = now()
	WHERE "client_id" = 'MccrztIIgsbUsYRBljbOZotSlSlRTFMn';

	GET DIAGNOSTICS updated_clients = ROW_COUNT;

	IF updated_clients <> 1 THEN
		RAISE EXCEPTION 'Expected exactly one GrapeOS OAuth client, updated %', updated_clients;
	END IF;
END $$;
