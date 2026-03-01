export const TENANT_LOGIN_EMAIL_DOMAIN = "login.ahi-ai.local";

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(normalizeUsername(value));
}

export function usernameToLoginEmail(username: string): string {
  return `${normalizeUsername(username)}@${TENANT_LOGIN_EMAIL_DOMAIN}`;
}

export function loginEmailToUsernameDisplay(email: string | null | undefined): string {
  if (!email) return "Hesap";
  const normalized = email.trim().toLowerCase();
  const suffix = `@${TENANT_LOGIN_EMAIL_DOMAIN}`;
  if (normalized.endsWith(suffix)) {
    return normalized.slice(0, -suffix.length);
  }
  return email;
}

