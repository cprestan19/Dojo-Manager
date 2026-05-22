/**
 * subir-imagenes.mjs
 * Corre desde la raíz del proyecto:  node subir-imagenes.mjs
 *
 * Sube las 4 imágenes del hero a Cloudinary.
 * Las URLs ya están en page.tsx — este script solo hace el upload.
 */
import { v2 as cloudinary } from "cloudinary";
import { existsSync } from "fs";
import { resolve } from "path";

cloudinary.config({
  cloud_name : "dkkoivmt6",
  api_key    : "785286369948237",
  api_secret : "TlJAOF6hFNYkfASVbK2_aR-K0Qw",
  secure     : true,
});

const IMAGES = [
  {
    file     : "pantalla_principal_del_administrador_de_dojo.jpg",
    publicId : "dojomasteronline/hero/dashboard",
  },
  {
    file     : "Control_de_Alumnos.jpg",
    publicId : "dojomasteronline/hero/alumnos",
  },
  {
    file     : "Modulo_de_Torneo_profecionl.jpg",
    publicId : "dojomasteronline/hero/torneo",
  },
  {
    file     : "pantalla_responsive.jpg",
    publicId : "dojomasteronline/hero/mobile",
  },
];

// Rutas donde buscar los archivos
const SEARCH_PATHS = [".", "public", "assets", "src/assets"];

function findFile(filename) {
  for (const dir of SEARCH_PATHS) {
    const full = resolve(process.cwd(), dir, filename);
    if (existsSync(full)) return full;
  }
  return null;
}

async function run() {
  console.log("\n🥋  Dojo Master — Upload de hero images a Cloudinary\n");

  for (const img of IMAGES) {
    const filePath = findFile(img.file);

    if (!filePath) {
      console.error(`❌  No encontré: ${img.file}`);
      console.error(`    Colócalo en la raíz del proyecto o en /public/\n`);
      continue;
    }

    console.log(`⬆️  Subiendo  →  ${img.publicId}`);
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        public_id    : img.publicId,
        overwrite    : true,
        quality      : "auto:best",
        fetch_format : "auto",
      });
      console.log(`✅  OK  →  ${result.secure_url}\n`);
    } catch (err) {
      console.error(`❌  Error: ${err.message}\n`);
    }
  }

  console.log("🚀  Listo. Verifica las imágenes en:");
  console.log("    https://console.cloudinary.com/pm/c-dkkoivmt6/media-explorer\n");
}

run();
