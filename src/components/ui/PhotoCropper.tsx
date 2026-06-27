"use client";
import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, RotateCw, Check, Camera } from "lucide-react";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = url;
  });
}

async function cropImage(imageSrc: string, pixelCrop: Area, rotation: number): Promise<string> {
  const image = await createImage(imageSrc);
  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  const tmp = document.createElement("canvas");
  tmp.width = safeArea;
  tmp.height = safeArea;
  const tCtx = tmp.getContext("2d")!;
  tCtx.translate(safeArea / 2, safeArea / 2);
  tCtx.rotate((rotation * Math.PI) / 180);
  tCtx.translate(-safeArea / 2, -safeArea / 2);
  tCtx.drawImage(image, safeArea / 2 - image.width / 2, safeArea / 2 - image.height / 2);

  const size = Math.min(pixelCrop.width, 800);
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const oCtx = out.getContext("2d")!;
  oCtx.drawImage(
    tmp,
    Math.round(safeArea / 2 - image.width  / 2 + pixelCrop.x),
    Math.round(safeArea / 2 - image.height / 2 + pixelCrop.y),
    pixelCrop.width,
    pixelCrop.height,
    0, 0, size, size,
  );

  return out.toDataURL("image/jpeg", 0.82);
}

interface Props {
  imageSrc: string;
  onCancel: () => void;
  onSave:   (croppedBase64: string) => void;
}

export default function PhotoCropper({ imageSrc, onCancel, onSave }: Props) {
  const [crop,              setCrop]              = useState({ x: 0, y: 0 });
  const [zoom,              setZoom]              = useState(1.2);
  const [rotation,          setRotation]          = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving,            setSaving]            = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  async function handleSave() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const result = await cropImage(imageSrc, croppedAreaPixels, rotation);
      onSave(result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-dojo-darker border-b border-dojo-border shrink-0">
        <button type="button" onClick={onCancel} className="btn-ghost p-2" aria-label="Cancelar">
          <X size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-dojo-white">Ajustar fotografía</p>
          <p className="text-xs text-dojo-muted">Arrastra · Pellizca · Desliza para rotar</p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
          {saving ? "Guardando..." : <><Check size={14} /> Listo</>}
        </button>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { background: "#000" },
            cropAreaStyle: {
              border: "3px solid #CC0000",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            },
          }}
        />
      </div>

      <div className="bg-dojo-darker border-t border-dojo-border px-5 py-4 space-y-4 shrink-0">
        <div className="space-y-1">
          <p className="text-xs text-dojo-muted uppercase tracking-wide">Zoom</p>
          <div className="flex items-center gap-3">
            <ZoomOut size={16} className="text-dojo-muted shrink-0" />
            <input type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-full accent-dojo-red cursor-pointer" />
            <ZoomIn size={16} className="text-dojo-muted shrink-0" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-dojo-muted uppercase tracking-wide">
            Rotación {rotation > 0 ? "+" : ""}{rotation}°
          </p>
          <div className="flex items-center gap-3">
            <RotateCw size={16} className="text-dojo-muted shrink-0 scale-x-[-1]" />
            <input type="range" min={-45} max={45} step={1} value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="w-full accent-dojo-red cursor-pointer" />
            <RotateCw size={16} className="text-dojo-muted shrink-0" />
          </div>
        </div>

        <div className="flex items-start gap-2 bg-dojo-card/60 rounded-lg px-3 py-2.5">
          <Camera size={13} className="text-dojo-gold shrink-0 mt-0.5" />
          <p className="text-xs text-dojo-muted leading-relaxed">
            La foto se recortará en forma circular, tal como aparecerá en el carnet.
            Solo se guarda el recorte final — no la imagen original.
          </p>
        </div>
      </div>
    </div>
  );
}
