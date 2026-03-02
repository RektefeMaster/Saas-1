const DEFAULT_APP_URL = "https://www.aiahi.net";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return DEFAULT_APP_URL;
  return normalizeBaseUrl(raw);
}

export function getDefaultAppUrl(): string {
  return DEFAULT_APP_URL;
}

