import { t } from "./i18n/ja";
import { useRef } from "react";

import { useRegisterSW } from "virtual:pwa-register/react";
export function PwaStatus() {
  const initiallyControlled = useRef(!!navigator.serviceWorker?.controller);
  const {
    needRefresh: [update, setUpdate],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <>
      {update && (
        <div className="update-banner">
          {t("pwastatus_132")}
          <button
            onClick={() => {
              if (
                !document.querySelector('[data-dirty="true"]') ||
                confirm(t("pwastatus_133"))
              ) {
                // Workbox captures isUpdate when registering. A first-install
                // tab may still be open when the next release arrives, so its
                // controlling event does not trigger the plugin's reload.
                if (!initiallyControlled.current) {
                  initiallyControlled.current = true;
                  navigator.serviceWorker.addEventListener(
                    "controllerchange",
                    () => window.location.reload(),
                    { once: true },
                  );
                }
                void updateServiceWorker(true);
              }
            }}
          >
            {t("pwastatus_134")}
          </button>
          <button onClick={() => setUpdate(false)}>{t("pwastatus_135")}</button>
        </div>
      )}
    </>
  );
}
