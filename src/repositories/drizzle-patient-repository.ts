import { and, eq, ilike, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { patients } from "../db/schema.js";
import type {
  CreatePatientInput,
  Patient,
  PatientFilters,
  UpdatePatientInput,
} from "../domain/patient.js";
import type { PatientRepository } from "./patient-repository.js";

type PatientRow = typeof patients.$inferSelect;

function toPatient(row: PatientRow): Patient {
  return {
    patient_id: row.patientId,
    first_name: row.firstName,
    last_name: row.lastName,
    date_of_birth: row.dateOfBirth,
    sex: row.sex,
    phone_number: row.phoneNumber,
    email: row.email,
    address_line_1: row.addressLine1,
    address_line_2: row.addressLine2,
    city: row.city,
    state: row.state as Patient["state"],
    zip_code: row.zipCode,
    insurance_provider: row.insuranceProvider,
    insurance_member_id: row.insuranceMemberId,
    preferred_language: row.preferredLanguage,
    emergency_contact_name: row.emergencyContactName,
    emergency_contact_phone: row.emergencyContactPhone,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  };
}

function createValues(input: CreatePatientInput): typeof patients.$inferInsert {
  return {
    firstName: input.first_name,
    lastName: input.last_name,
    dateOfBirth: input.date_of_birth,
    sex: input.sex,
    phoneNumber: input.phone_number,
    email: input.email ?? null,
    addressLine1: input.address_line_1,
    addressLine2: input.address_line_2 ?? null,
    city: input.city,
    state: input.state,
    zipCode: input.zip_code,
    insuranceProvider: input.insurance_provider ?? null,
    insuranceMemberId: input.insurance_member_id ?? null,
    preferredLanguage: input.preferred_language ?? "English",
    emergencyContactName: input.emergency_contact_name ?? null,
    emergencyContactPhone: input.emergency_contact_phone ?? null,
  };
}

function updateValues(
  input: UpdatePatientInput,
): Partial<typeof patients.$inferInsert> {
  const fieldMap = {
    first_name: "firstName",
    last_name: "lastName",
    date_of_birth: "dateOfBirth",
    sex: "sex",
    phone_number: "phoneNumber",
    email: "email",
    address_line_1: "addressLine1",
    address_line_2: "addressLine2",
    city: "city",
    state: "state",
    zip_code: "zipCode",
    insurance_provider: "insuranceProvider",
    insurance_member_id: "insuranceMemberId",
    preferred_language: "preferredLanguage",
    emergency_contact_name: "emergencyContactName",
    emergency_contact_phone: "emergencyContactPhone",
  } as const;

  const values: Record<string, unknown> = {};
  for (const [apiField, databaseField] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      const value = input[apiField as keyof UpdatePatientInput];
      values[databaseField] = value ?? null;
    }
  }
  values.updatedAt = new Date().toISOString();
  return values;
}

export class DrizzlePatientRepository implements PatientRepository {
  constructor(private readonly db: Database) {}

  async findMany(filters: PatientFilters): Promise<Patient[]> {
    const conditions = [isNull(patients.deletedAt)];
    if (filters.last_name) {
      conditions.push(ilike(patients.lastName, filters.last_name));
    }
    if (filters.date_of_birth) {
      conditions.push(eq(patients.dateOfBirth, filters.date_of_birth));
    }
    if (filters.phone_number) {
      conditions.push(eq(patients.phoneNumber, filters.phone_number));
    }

    const rows = await this.db
      .select()
      .from(patients)
      .where(and(...conditions))
      .orderBy(patients.createdAt);
    return rows.map(toPatient);
  }

  async findById(patientId: string): Promise<Patient | null> {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(
        and(eq(patients.patientId, patientId), isNull(patients.deletedAt)),
      )
      .limit(1);
    return row ? toPatient(row) : null;
  }

  async findByPhone(phoneNumber: string): Promise<Patient | null> {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.phoneNumber, phoneNumber),
          isNull(patients.deletedAt),
        ),
      )
      .orderBy(patients.updatedAt)
      .limit(1);
    return row ? toPatient(row) : null;
  }

  async create(input: CreatePatientInput): Promise<Patient> {
    const [row] = await this.db
      .insert(patients)
      .values(createValues(input))
      .returning();
    if (!row) throw new Error("Database did not return the created patient");
    return toPatient(row);
  }

  async update(
    patientId: string,
    input: UpdatePatientInput,
  ): Promise<Patient | null> {
    const [row] = await this.db
      .update(patients)
      .set(updateValues(input))
      .where(
        and(eq(patients.patientId, patientId), isNull(patients.deletedAt)),
      )
      .returning();
    return row ? toPatient(row) : null;
  }

  async softDelete(patientId: string): Promise<Patient | null> {
    const deletedAt = new Date().toISOString();
    const [row] = await this.db
      .update(patients)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(
        and(eq(patients.patientId, patientId), isNull(patients.deletedAt)),
      )
      .returning();
    return row ? toPatient(row) : null;
  }
}
