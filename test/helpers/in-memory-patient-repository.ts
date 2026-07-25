import type {
  CreatePatientInput,
  Patient,
  PatientFilters,
  UpdatePatientInput,
} from "../../src/domain/patient.js";
import type { PatientRepository } from "../../src/repositories/patient-repository.js";

export class InMemoryPatientRepository implements PatientRepository {
  private readonly records = new Map<string, Patient>();

  async findMany(filters: PatientFilters): Promise<Patient[]> {
    return [...this.records.values()]
      .filter((patient) => patient.deleted_at === null)
      .filter(
        (patient) =>
          !filters.last_name ||
          patient.last_name.toLowerCase() === filters.last_name.toLowerCase(),
      )
      .filter(
        (patient) =>
          !filters.date_of_birth ||
          patient.date_of_birth === filters.date_of_birth,
      )
      .filter(
        (patient) =>
          !filters.phone_number ||
          patient.phone_number === filters.phone_number,
      )
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  async findById(patientId: string): Promise<Patient | null> {
    const patient = this.records.get(patientId);
    return patient && patient.deleted_at === null ? patient : null;
  }

  async findByPhone(phoneNumber: string): Promise<Patient | null> {
    return (
      [...this.records.values()].find(
        (patient) =>
          patient.deleted_at === null &&
          patient.phone_number === phoneNumber,
      ) ?? null
    );
  }

  async create(input: CreatePatientInput): Promise<Patient> {
    const timestamp = new Date().toISOString();
    const patient: Patient = {
      patient_id: crypto.randomUUID(),
      first_name: input.first_name,
      last_name: input.last_name,
      date_of_birth: input.date_of_birth,
      sex: input.sex,
      phone_number: input.phone_number,
      email: input.email ?? null,
      address_line_1: input.address_line_1,
      address_line_2: input.address_line_2 ?? null,
      city: input.city,
      state: input.state,
      zip_code: input.zip_code,
      insurance_provider: input.insurance_provider ?? null,
      insurance_member_id: input.insurance_member_id ?? null,
      preferred_language: input.preferred_language ?? "English",
      emergency_contact_name: input.emergency_contact_name ?? null,
      emergency_contact_phone: input.emergency_contact_phone ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };
    this.records.set(patient.patient_id, patient);
    return patient;
  }

  async update(
    patientId: string,
    input: UpdatePatientInput,
  ): Promise<Patient | null> {
    const existing = await this.findById(patientId);
    if (!existing) return null;

    const updated = { ...existing } as Patient & Record<string, unknown>;
    for (const [key, value] of Object.entries(input)) {
      updated[key] = value ?? null;
    }
    updated.updated_at = new Date().toISOString();
    this.records.set(patientId, updated);
    return updated;
  }

  async softDelete(patientId: string): Promise<Patient | null> {
    const existing = await this.findById(patientId);
    if (!existing) return null;
    const timestamp = new Date().toISOString();
    const deleted = {
      ...existing,
      deleted_at: timestamp,
      updated_at: timestamp,
    };
    this.records.set(patientId, deleted);
    return deleted;
  }
}
