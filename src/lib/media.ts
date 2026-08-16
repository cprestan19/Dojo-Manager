import { deleteResource, type UploadType } from "@/lib/cloudinary";
import { deleteFile } from "@/lib/imagekit";
import { isOwnCloudinaryUrl, isOwnImageKitUrl } from "@/lib/upload-validation";

/**
 * Borra un archivo del proveedor correcto (Cloudinary o ImageKit) según a
 * cuál pertenece la URL guardada. El mismo campo de BD (ej. `publicId`)
 * puede contener un public_id de Cloudinary (archivo legado) o un fileId
 * de ImageKit (subido después de la migración) — hay que revisar la URL
 * para saber cuál API llamar. Nunca lanza: un fallo de borrado no debe
 * bloquear la operación principal (reemplazo/eliminación del registro).
 */
export async function deleteMediaAsset(
  url:  string | null | undefined,
  id:   string | null | undefined,
  type: UploadType = "image",
): Promise<void> {
  if (!id || !url) return;
  try {
    if (isOwnImageKitUrl(url)) {
      await deleteFile(id);
    } else if (isOwnCloudinaryUrl(url)) {
      await deleteResource(id, type);
    }
  } catch {
    /* no bloquear la operación principal por un fallo de borrado */
  }
}
