import type {
  CreatePatientInput,
  Patient,
  PatientFilters,
  UpdatePatientInput,
} from "../domain/patient.js";

export interface PatientRepository {
  findMany(filters: PatientFilters): Promise<Patient[]>;
  findById(patientId: string): Promise<Patient | null>;
  findByPhone(phoneNumber: string): Promise<Patient | null>;
  create(input: CreatePatientInput): Promise<Patient>;
  update(
    patientId: string,
    input: UpdatePatientInput,
  ): Promise<Patient | null>;
  softDelete(patientId: string): Promise<Patient | null>;
}
