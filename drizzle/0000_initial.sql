CREATE TYPE "patient_sex" AS ENUM (
  'Male',
  'Female',
  'Other',
  'Decline to Answer'
);

CREATE TYPE "us_state" AS ENUM (
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
);

CREATE TABLE "patients" (
  "patient_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "first_name" varchar(50) NOT NULL,
  "last_name" varchar(50) NOT NULL,
  "date_of_birth" date NOT NULL,
  "sex" "patient_sex" NOT NULL,
  "phone_number" varchar(10) NOT NULL,
  "email" varchar(254),
  "address_line_1" varchar(200) NOT NULL,
  "address_line_2" varchar(200),
  "city" varchar(100) NOT NULL,
  "state" "us_state" NOT NULL,
  "zip_code" varchar(10) NOT NULL,
  "insurance_provider" varchar(100),
  "insurance_member_id" varchar(100),
  "preferred_language" varchar(50) DEFAULT 'English' NOT NULL,
  "emergency_contact_name" varchar(100),
  "emergency_contact_phone" varchar(10),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "patients_phone_number_check"
    CHECK ("phone_number" ~ '^[0-9]{10}$'),
  CONSTRAINT "patients_emergency_phone_check"
    CHECK ("emergency_contact_phone" IS NULL OR "emergency_contact_phone" ~ '^[0-9]{10}$'),
  CONSTRAINT "patients_zip_code_check"
    CHECK ("zip_code" ~ '^[0-9]{5}(-[0-9]{4})?$'),
  CONSTRAINT "patients_date_of_birth_check"
    CHECK ("date_of_birth" <= CURRENT_DATE)
);

CREATE INDEX "patients_last_name_idx" ON "patients" ("last_name");
CREATE INDEX "patients_date_of_birth_idx" ON "patients" ("date_of_birth");
CREATE INDEX "patients_phone_number_idx" ON "patients" ("phone_number");
CREATE INDEX "patients_deleted_at_idx" ON "patients" ("deleted_at");

CREATE OR REPLACE FUNCTION "set_patients_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "patients_set_updated_at"
BEFORE UPDATE ON "patients"
FOR EACH ROW
EXECUTE FUNCTION "set_patients_updated_at"();
