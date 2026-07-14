import { describe, expect, it } from "vitest";

import { normalizeLoginIdentifier } from "@/lib/auth/credentials";
import { getAppRole, isReadOnlyUser } from "@/lib/auth/roles";

describe("authentication helpers", () => {
  it("maps a username to the internal authentication email", () => {
    expect(normalizeLoginIdentifier(" MKT ")).toBe("mkt@revdashboard.local");
  });

  it("keeps an email login while normalizing its case", () => {
    expect(normalizeLoginIdentifier(" Owner@Example.com ")).toBe("owner@example.com");
  });

  it("treats only the viewer role as read-only", () => {
    const viewer = { app_metadata: { role: "viewer" } };
    const owner = { app_metadata: {} };

    expect(getAppRole(viewer)).toBe("viewer");
    expect(isReadOnlyUser(viewer)).toBe(true);
    expect(getAppRole(owner)).toBe("owner");
    expect(isReadOnlyUser(owner)).toBe(false);
  });
});
