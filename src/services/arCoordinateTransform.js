/**
 * SmartBreadboard 3D — Real-Time AR Coordinate Transformation Engine
 * Phase 22.2 Service Re-export & Coordinate Mapping
 *
 * Provides:
 * - Camera image pixel to screen/canvas coordinate mapping
 * - Screen aspect ratio & object-fit letterbox calculation
 * - Component anchor & terminal marker calculation
 * - Homography perspective transformation & temporal smoothing
 */

export {
  calculateVideoDisplayRect,
  cameraPixelToScreenCoord,
  screenCoordToCameraPixel,
  calculateComponentAnchor,
  transformHomographyPoint,
  smoothHomographyEMA
} from '../utils/arCoordinateTransform';
