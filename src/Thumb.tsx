import { t } from "./i18n/ja";
import { useEffect, useRef, useState } from "react";
import { acquireImageUrl } from "./local/files/objectUrlCache";
export function Thumb({
  id,
  alt = t("app_006"),
  className = "",
}: {
  id: string | null;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string>(),
    [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    let alive = true,
      release: (() => void) | undefined;
    setFailed(false);
    setUrl(undefined);
    if (!id) return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void acquireImageUrl(id)
          .then((handle) => {
            if (alive) {
              release = handle.release;
              setUrl(handle.url);
            } else handle.release();
          })
          .catch(() => {
            if (alive) setFailed(true);
          });
      },
      { rootMargin: "250px" },
    );
    observer.observe(element);
    return () => {
      alive = false;
      observer.disconnect();
      release?.();
    };
  }, [id]);
  return id && !failed ? (
    <img
      ref={ref}
      className={className}
      src={
        url ??
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/%3E'
      }
      alt={alt}
    />
  ) : (
    <div className={`placeholder ${className}`} role="img" aria-label={alt}>
      ▧
    </div>
  );
}
