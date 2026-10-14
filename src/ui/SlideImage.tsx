import type { Slide } from '../model/types';
import { useAssetUrl } from '../storage/assetUrl';

export default function SlideImage({
  slide,
  className,
}: {
  slide: Slide | undefined;
  className?: string;
}) {
  const url = useAssetUrl(slide?.assetId);
  if (!slide || !url) return <div className={`slide-img placeholder ${className ?? ''}`} />;
  return (
    <img
      className={`slide-img ${className ?? ''}`}
      src={url}
      alt={slide.source ?? ''}
      draggable={false}
    />
  );
}
