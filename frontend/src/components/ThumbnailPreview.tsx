import type { Variant } from "../api/types";
import { useT } from "../i18n/I18nContext";

export default function ThumbnailPreview({ variant }: { variant: Variant }) {
  const t = useT();

  return (
    <div className="text-center">
      <div className="font-medium text-sm mb-1">{t("thumbnail.pattern", { label: variant.label })}</div>
      {variant.thumbnail_url ? (
        <img
          src={variant.thumbnail_url}
          alt={t("thumbnail.pattern", { label: variant.label })}
          className="w-full rounded border border-gray-200 aspect-video object-cover"
        />
      ) : (
        <div className="w-full aspect-video bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
          {t("thumbnail.noPreview")}
        </div>
      )}
      <div className="mt-1 text-xs text-gray-500">
        {t("thumbnail.velocity", { velocity: variant.avg_velocity.toFixed(1), count: variant.measurement_count })}
      </div>
    </div>
  );
}
