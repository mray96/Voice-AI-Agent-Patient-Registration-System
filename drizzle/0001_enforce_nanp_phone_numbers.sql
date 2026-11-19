BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "patients"
    WHERE "phone_number" !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'
       OR (
         "emergency_contact_phone" IS NOT NULL
         AND "emergency_contact_phone" !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'
       )
  ) THEN
    RAISE EXCEPTION
      'Invalid NANP phone data exists. Correct those fictional records before applying this migration.';
  END IF;
END;
$$;

ALTER TABLE "patients"
  DROP CONSTRAINT "patients_phone_number_check";

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_phone_number_check"
  CHECK ("phone_number" ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$');

ALTER TABLE "patients"
  DROP CONSTRAINT "patients_emergency_phone_check";

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_emergency_phone_check"
  CHECK (
    "emergency_contact_phone" IS NULL
    OR "emergency_contact_phone" ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'
  );

COMMIT;
