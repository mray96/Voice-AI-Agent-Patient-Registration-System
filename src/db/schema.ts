import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const patientSex = pgEnum("patient_sex", [
  "Male",
  "Female",
  "Other",
  "Decline to Answer",
]);

export const usState = pgEnum("us_state", [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

export const patients = pgTable(
  "patients",
  {
    patientId: uuid("patient_id").defaultRandom().primaryKey(),
    firstName: varchar("first_name", { length: 50 }).notNull(),
    lastName: varchar("last_name", { length: 50 }).notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    sex: patientSex("sex").notNull(),
    phoneNumber: varchar("phone_number", { length: 10 }).notNull(),
    email: varchar("email", { length: 254 }),
    addressLine1: varchar("address_line_1", { length: 200 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 200 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: usState("state").notNull(),
    zipCode: varchar("zip_code", { length: 10 }).notNull(),
    insuranceProvider: varchar("insurance_provider", { length: 100 }),
    insuranceMemberId: varchar("insurance_member_id", { length: 100 }),
    preferredLanguage: varchar("preferred_language", { length: 50 })
      .notNull()
      .default("English"),
    emergencyContactName: varchar("emergency_contact_name", { length: 100 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 10 }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    check(
      "patients_phone_number_check",
      sql`${table.phoneNumber} ~ '^[0-9]{10}$'`,
    ),
    check(
      "patients_emergency_phone_check",
      sql`${table.emergencyContactPhone} IS NULL OR ${table.emergencyContactPhone} ~ '^[0-9]{10}$'`,
    ),
    check(
      "patients_zip_code_check",
      sql`${table.zipCode} ~ '^[0-9]{5}(-[0-9]{4})?$'`,
    ),
    check(
      "patients_date_of_birth_check",
      sql`${table.dateOfBirth} <= CURRENT_DATE`,
    ),
    index("patients_last_name_idx").on(table.lastName),
    index("patients_date_of_birth_idx").on(table.dateOfBirth),
    index("patients_phone_number_idx").on(table.phoneNumber),
    index("patients_deleted_at_idx").on(table.deletedAt),
  ],
);
