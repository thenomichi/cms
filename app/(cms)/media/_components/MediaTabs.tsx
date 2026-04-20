/**
 * This file previously contained all media tab logic.
 * The functionality has been split into:
 *   - TripImagesView.tsx  (trip-centric image management)
 *   - SiteGalleryMomentsView.tsx  (site gallery + real moments)
 *
 * MediaClient.tsx now composes those directly.
 */

export { TripImagesView } from "./TripImagesView";
export { SiteGalleryMomentsView } from "./SiteGalleryMomentsView";
