import validator from "validator";

export function isValidEmail(value: string): boolean {
  return typeof value === "string" && validator.isEmail(value.trim());
}
