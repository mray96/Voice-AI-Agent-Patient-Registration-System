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

  it("accepts common U.S. formats and a country code", () => {
    expect(normalizePhone("+1 415 555 0123")).toBe("4155550123");
    expect(normalizePhone("1-651-386-9251")).toBe("6513869251");
    expect(normalizePhone("(651) 386-9251")).toBe("6513869251");
    expect(normalizePhone("6513869251")).toBe("6513869251");
  });

  it("rejects invalid NANP prefixes, malformed input, and other lengths", () => {
    expect(normalizePhone("555")).toBeNull();
    expect(normalizePhone("0000000000")).toBeNull();
    expect(normalizePhone("1234567890")).toBeNull();
    expect(normalizePhone("651-123-9251")).toBeNull();
    expect(normalizePhone("call 651-386-9251")).toBeNull();
    expect(normalizePhone("651)-386-9251")).toBeNull();
    expect(normalizePhone("+44 651 386 9251")).toBeNull();
  });

  it("applies U.S. phone validation to an optional emergency contact", () => {
    const result = createPatientSchema.safeParse({
      ...validPatientInput,
      emergency_contact_phone: "000-000-0000",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["emergency_contact_phone"] }),
        ]),
      );
    }
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
