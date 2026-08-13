import { describe, it, expect, afterEach, vi } from "vitest";
import { isOwnCloudinaryUrl, isOwnImageKitUrl, isOwnMediaUrl } from "../upload-validation";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isOwnCloudinaryUrl", () => {
  it("accepts a URL under our own cloud name", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    expect(isOwnCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/v1/logo.png")).toBe(true);
  });

  it("rejects a different Cloudinary account (someone else's cloud name)", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    expect(isOwnCloudinaryUrl("https://res.cloudinary.com/attacker-cloud/image/upload/v1/x.png")).toBe(false);
  });

  it("rejects a host that merely looks like Cloudinary", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    expect(isOwnCloudinaryUrl("https://res.cloudinary.com.evil.com/demo/x.png")).toBe(false);
  });

  it("rejects non-https protocols", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    expect(isOwnCloudinaryUrl("http://res.cloudinary.com/demo/x.png")).toBe(false);
  });

  it("rejects an internal/arbitrary SSRF target", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    expect(isOwnCloudinaryUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("rejects everything when CLOUDINARY_CLOUD_NAME is unset", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    expect(isOwnCloudinaryUrl("https://res.cloudinary.com/demo/x.png")).toBe(false);
  });

  it("does not throw on a malformed URL", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    expect(isOwnCloudinaryUrl("not a url")).toBe(false);
  });
});

describe("isOwnImageKitUrl", () => {
  it("accepts a URL under our own ImageKit endpoint", () => {
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/eventstaff");
    expect(isOwnImageKitUrl("https://ik.imagekit.io/eventstaff/receipts/abc.pdf")).toBe(true);
  });

  it("rejects a different ImageKit account", () => {
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/eventstaff");
    expect(isOwnImageKitUrl("https://ik.imagekit.io/someone-else/receipts/abc.pdf")).toBe(false);
  });

  it("rejects an internal/arbitrary SSRF target", () => {
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/eventstaff");
    expect(isOwnImageKitUrl("http://internal-admin.local/secrets")).toBe(false);
  });

  it("rejects everything when IMAGEKIT_URL_ENDPOINT is unset", () => {
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "");
    expect(isOwnImageKitUrl("https://ik.imagekit.io/eventstaff/x.png")).toBe(false);
  });
});

describe("isOwnMediaUrl", () => {
  it("accepts either our Cloudinary or our ImageKit URL", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/eventstaff");
    expect(isOwnMediaUrl("https://res.cloudinary.com/demo/image/upload/logo.png")).toBe(true);
    expect(isOwnMediaUrl("https://ik.imagekit.io/eventstaff/receipts/abc.pdf")).toBe(true);
  });

  it("rejects an SSRF target that matches neither provider", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/eventstaff");
    expect(isOwnMediaUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isOwnMediaUrl("http://localhost:8080/admin")).toBe(false);
  });
});
