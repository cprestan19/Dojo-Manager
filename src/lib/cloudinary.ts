import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export type UploadType = "image" | "video";

export interface UploadResult {
  url:      string;
  publicId: string;
}

export async function uploadBuffer(
  buffer:   Buffer,
  folder:   string,
  type:     UploadType = "image",
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: type,
        // Auto-quality and format for images; preserve originals for video
        ...(type === "image"
          ? { quality: "auto", fetch_format: "auto" }
          : { video_codec: "auto" }),
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    ).end(buffer);
  });
}

export async function deleteResource(publicId: string, type: UploadType = "image"): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: type });
}

export default cloudinary;
