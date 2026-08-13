import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockUploadBuffer = vi.fn();
vi.mock("@/lib/imagekit", () => ({ uploadBuffer: mockUploadBuffer }));

const { renderPaymentReceiptPdf, generateAndUploadReceiptPdf } = await import("../receiptPdf");

// PNG 1x1 válido — suficiente para que jsPDF.getImageProperties() lo acepte.
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const TINY_PNG_BYTES  = Buffer.from(TINY_PNG_BASE64, "base64");

const baseData = {
  dojoName:    "Dojo Natsuki",
  receiptNo:   "AB12CD34",
  studentName: "Karina Cepede",
  studentCode: 1042,
  concept:     "Mensualidad agosto de 2026",
  paidDate:    "09/08/2026",
  amount:      60,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderPaymentReceiptPdf", () => {
  it("returns a valid PDF buffer", async () => {
    const buffer = await renderPaymentReceiptPdf(baseData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("does not throw when studentCode is null", async () => {
    await expect(renderPaymentReceiptPdf({ ...baseData, studentCode: null })).resolves.toBeInstanceOf(Buffer);
  });

  it("embeds the dojo logo when dojoLogoUrl is our own Cloudinary URL", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => TINY_PNG_BYTES.buffer.slice(TINY_PNG_BYTES.byteOffset, TINY_PNG_BYTES.byteOffset + TINY_PNG_BYTES.byteLength),
    }));

    const buffer = await renderPaymentReceiptPdf({ ...baseData, dojoLogoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png" });

    expect(fetch).toHaveBeenCalledWith("https://res.cloudinary.com/demo/image/upload/logo.png");
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("embeds the dojo logo when dojoLogoUrl is legacy base64 (with data: prefix)", async () => {
    const buffer = await renderPaymentReceiptPdf({
      ...baseData,
      dojoLogoUrl: `data:image/png;base64,${TINY_PNG_BASE64}`,
    });
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("falls back to text-only header without throwing when the logo fetch fails", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const buffer = await renderPaymentReceiptPdf({ ...baseData, dojoLogoUrl: "https://res.cloudinary.com/demo/broken.png" });

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  // Regresión SSRF: un dojoLogoUrl que no sea de nuestro propio Cloudinary/
  // ImageKit nunca debe fetchearse server-side, sin importar qué host sea.
  it("never fetches a logo URL outside our own Cloudinary/ImageKit (SSRF guard)", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/eventstaff");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => TINY_PNG_BYTES.buffer });
    vi.stubGlobal("fetch", fetchSpy);

    const buffer = await renderPaymentReceiptPdf({
      ...baseData,
      dojoLogoUrl: "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

describe("generateAndUploadReceiptPdf", () => {
  it("uploads the rendered PDF to ImageKit and returns link + filename + publicId", async () => {
    mockUploadBuffer.mockResolvedValue({ url: "https://ik.imagekit.io/eventstaff/receipts/abc.pdf", fileId: "68a1b2c3d4e5f6" });

    const result = await generateAndUploadReceiptPdf(baseData);

    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer), "recibo-AB12CD34.pdf", "receipts", "application/pdf",
    );
    expect(result).toEqual({
      link:     "https://ik.imagekit.io/eventstaff/receipts/abc.pdf",
      filename: "recibo-AB12CD34.pdf",
      publicId: "68a1b2c3d4e5f6",
    });
  });
});
