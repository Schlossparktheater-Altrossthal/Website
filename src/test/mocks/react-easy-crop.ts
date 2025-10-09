import type { FC, ReactNode } from "react";

export type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropperProps = {
  image?: string | null;
  crop?: { x: number; y: number };
  zoom?: number;
  aspect?: number;
  cropShape?: string;
  showGrid?: boolean;
  objectFit?: string;
  onCropChange?: (crop: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
  onCropComplete?: (area: Area, areaPixels: Area) => void;
  initialCroppedAreaPercentages?: Area;
  children?: ReactNode;
  [key: string]: unknown;
};

const Cropper: FC<CropperProps> = () => null;

export default Cropper;
