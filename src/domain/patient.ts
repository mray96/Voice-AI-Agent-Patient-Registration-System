import { z } from "zod";

export const US_STATES = [
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
] as const;

export const SEX_VALUES = [
  "Male",
  "Female",
  "Other",
  "Decline to Answer",
] as const;

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    /^\p{L}+(?:[ '\-\u2019]\p{L}+)*$/u,
    "Use letters, spaces, hyphens, or apostrophes only",
  );

const optionalString = (maximum: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(maximum).optional());

export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();

  // Accept common US formats, but reject malformed punctuation, letters, and
  // other arbitrary content instead of silently stripping it from the input.
  const presentation =
    /^(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}$/;
  if (!presentation.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  // NANP area (NPA) and exchange (NXX) codes both start with 2-9.
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? digits : null;
}

export function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  let year: number;
  let month: number;
  let day: number;

  const usMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (usMatch) {
    month = Number(usMatch[1]);
    day = Number(usMatch[2]);
    year = Number(usMatch[3]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  if (date.getTime() > todayUtc) return null;

  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

const phoneSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      context.addIssue({
        code: "custom",
        message: "Enter a valid 10-digit U.S. phone number",
      });
      return z.NEVER;
    }
    return normalized;
  });

const dateSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const normalized = normalizeDate(value);
    if (!normalized) {
      context.addIssue({
        code: "custom",
        message: "Enter a real, non-future date as MM/DD/YYYY or YYYY-MM-DD",
      });
      return z.NEVER;
    }
    return normalized;
  });

const optionalPhoneSchema = z.preprocess(
  emptyToUndefined,
  phoneSchema.optional(),
);

const optionalEmailSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().email().max(254).optional(),
);

const sexSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  const match = SEX_VALUES.find((entry) => entry.toLowerCase() === normalized);
  return match ?? value;
}, z.enum(SEX_VALUES));

const stateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(US_STATES));

const patientInputShape = {
  first_name: nameSchema,
  last_name: nameSchema,
  date_of_birth: dateSchema,
  sex: sexSchema,
  phone_number: phoneSchema,
  email: optionalEmailSchema,
  address_line_1: z.string().trim().min(1).max(200),
  address_line_2: optionalString(200),
  city: z.string().trim().min(1).max(100),
  state: stateSchema,
  zip_code: z
    .string()
    .trim()
    .regex(/^\d{5}(?:-\d{4})?$/, "Enter a 5-digit ZIP or ZIP+4"),
  insurance_provider: optionalString(100),
  insurance_member_id: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9 -]+$/, "Use letters, numbers, spaces, or hyphens")
      .optional(),
  ),
  preferred_language: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(2).max(50).default("English"),
  ),
  emergency_contact_name: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(100).optional(),
  ),
  emergency_contact_phone: optionalPhoneSchema,
};

export const createPatientSchema = z.object(patientInputShape).strict();

export const updatePatientSchema = z
  .object(patientInputShape)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const patientFilterSchema = z
  .object({
    last_name: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).max(50).optional(),
    ),
    date_of_birth: z.preprocess(emptyToUndefined, dateSchema.optional()),
    phone_number: z.preprocess(emptyToUndefined, phoneSchema.optional()),
  })
  .strict();

export const patientIdSchema = z.string().uuid();

export type PatientSex = (typeof SEX_VALUES)[number];
export type CreatePatientInput = z.output<typeof createPatientSchema>;
export type UpdatePatientInput = z.output<typeof updatePatientSchema>;
export type PatientFilters = z.output<typeof patientFilterSchema>;

export interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: PatientSex;
  phone_number: string;
  email: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: (typeof US_STATES)[number];
  zip_code: string;
  insurance_provider: string | null;
  insurance_member_id: string | null;
  preferred_language: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
