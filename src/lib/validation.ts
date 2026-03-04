import validator from "validator";

export function isValidEmail(value: string): boolean {
  return typeof value === "string" && validator.isEmail(value.trim());
}

export function isValidUrl(value: string, options?: { requireProtocol?: boolean }): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  return validator.isURL(value.trim(), {
    require_protocol: options?.requireProtocol ?? false,
    protocols: ["http", "https"],
  });
}
