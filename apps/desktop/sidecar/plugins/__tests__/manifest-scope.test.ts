import { describe, it, expect } from "vitest";
import { parseManifest } from "../manifest";

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    description: "A test plugin",
    author: "Test Author",
    scope: "personal",
    runtime: { image: "test:latest", port: 3000 },
    permissions: ["server.read"],
    ...overrides,
  };
}

describe("parseManifest — scope field", () => {
  it("accepts scope: 'personal'", () => {
    const { manifest, errors } = parseManifest(validManifest({ scope: "personal" }));
    expect(errors).toHaveLength(0);
    expect(manifest.scope).toBe("personal");
  });

  it("accepts scope: 'server'", () => {
    const { manifest, errors } = parseManifest(validManifest({ scope: "server" }));
    expect(errors).toHaveLength(0);
    expect(manifest.scope).toBe("server");
  });

  it("accepts scope: 'both'", () => {
    const { manifest, errors } = parseManifest(validManifest({ scope: "both" }));
    expect(errors).toHaveLength(0);
    expect(manifest.scope).toBe("both");
  });

  it("rejects missing scope", () => {
    const raw = validManifest();
    delete (raw as Record<string, unknown>).scope;
    const { errors } = parseManifest(raw);
    expect(errors).toContain("scope must be 'server', 'personal', or 'both'");
  });

  it("rejects invalid scope value", () => {
    const { errors } = parseManifest(validManifest({ scope: "global" }));
    expect(errors).toContain("scope must be 'server', 'personal', or 'both'");
  });

  it("rejects numeric scope", () => {
    const { errors } = parseManifest(validManifest({ scope: 42 }));
    expect(errors).toContain("scope must be 'server', 'personal', or 'both'");
  });

  it("defaults to 'personal' in constructed manifest when scope is invalid", () => {
    const { manifest } = parseManifest(validManifest({ scope: "invalid" }));
    expect(manifest.scope).toBe("personal");
  });
});
