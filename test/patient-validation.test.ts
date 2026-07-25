import { describe, expect, it } from "vitest";
import {
  createPatientSchema,
  normalizeDate,
  normalizePhone,
} from "../src/domain/patient.js";
import { validPatientInput } from "./fixtures.js";

describe("patient validation", () => {
  it("normalizes dates, phone numbers, state, and optional defaults", () => {
    const result = createPatientSchema.parse({
      ...validPatientInput,
      preferred_language: "",
    });

    expect(result.date_of_birth).toBe("1990-06-15");
    expect(result.phone_number).toBe("4155550123");
    expect(result.emergency_contact_phone).toBe("4155550199");
    expect(result.state).toBe("CA");
    expect(result.preferred_language).toBe("English");
  });

  it("accepts ISO dates and rejects impossible or future dates", () => {
    expect(normalizeDate("1990-06-15")).toBe("1990-06-15");
    expect(normalizeDate("02/30/2020")).toBeNull();
    expect(normalizeDate("01/01/2999")).toBeNull();
  });

  it("accepts a U.S. country code but rejects other lengths", () => {
    expect(normalizePhone("+1 415 555 0123")).toBe("4155550123");
    expect(normalizePhone("555")).toBeNull();
  });

  it("rejects invalid names, states, ZIP codes, and emails", () => {
    const result = createPatientSchema.safeParse({
      ...validPatientInput,
      first_name: "Jane3",
      state: "XX",
      zip_code: "123",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(
        expect.arrayContaining(["first_name", "state", "zip_code", "email"]),
      );
    }
  });
});
