import type {
  CreatePatientInput,
  PatientFilters,
  UpdatePatientInput,
} from "../domain/patient.js";
import { AppError } from "../lib/errors.js";
import type { PatientRepository } from "../repositories/patient-repository.js";

export class PatientService {
  constructor(private readonly repository: PatientRepository) {}

  list(filters: PatientFilters) {
    return this.repository.findMany(filters);
  }

  async get(patientId: string) {
    const patient = await this.repository.findById(patientId);
    if (!patient) {
      throw new AppError(404, "PATIENT_NOT_FOUND", "Patient was not found");
    }
    return patient;
  }

  findByPhone(phoneNumber: string) {
    return this.repository.findByPhone(phoneNumber);
  }

  async create(input: CreatePatientInput) {
    const patient = await this.repository.create(input);
    console.info(
      JSON.stringify({
        event: "patient.created",
        patient,
      }),
    );
    return patient;
  }

  async update(patientId: string, input: UpdatePatientInput) {
    const patient = await this.repository.update(patientId, input);
    if (!patient) {
      throw new AppError(404, "PATIENT_NOT_FOUND", "Patient was not found");
    }
    console.info(
      JSON.stringify({
        event: "patient.updated",
        patient,
      }),
    );
    return patient;
  }

  async remove(patientId: string) {
    const patient = await this.repository.softDelete(patientId);
    if (!patient) {
      throw new AppError(404, "PATIENT_NOT_FOUND", "Patient was not found");
    }
    return patient;
  }
}
