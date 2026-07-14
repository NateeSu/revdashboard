const USERNAME_EMAIL_DOMAIN = "revdashboard.local";

export function normalizeLoginIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@${USERNAME_EMAIL_DOMAIN}`;
}
