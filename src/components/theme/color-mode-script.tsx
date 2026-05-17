import {
  DEFAULT_COLOR_MODE,
  type ThemeColorMode,
} from "@/lib/website-settings";

export type ColorModeScriptProps = {
  mode: ThemeColorMode;
};

export function ColorModeScript({ mode }: ColorModeScriptProps) {
  const script = `(() => {
    const root = document.documentElement;
    const attribute = "data-color-mode";
    const defaultMode = ${JSON.stringify(DEFAULT_COLOR_MODE)};
    const initialMode = ${JSON.stringify(mode)};
    const supportsMatchMedia = typeof window.matchMedia === "function";
    const preferenceQuery = supportsMatchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    const addPreferenceListener = (listener) => {
      if (!preferenceQuery) {
        return () => {};
      }
      if (typeof preferenceQuery.addEventListener === "function") {
        preferenceQuery.addEventListener("change", listener);
        return () => {
          preferenceQuery.removeEventListener("change", listener);
        };
      }
      preferenceQuery.addListener(listener);
      return () => {
        preferenceQuery.removeListener(listener);
      };
    };

    let removePreferenceListener = null;
    let observer = null;
    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) {
        return;
      }
      isCleanedUp = true;

      if (observer) {
        observer.disconnect();
        observer = null;
      }

      if (removePreferenceListener) {
        removePreferenceListener();
        removePreferenceListener = null;
      }

      window.removeEventListener("pagehide", cleanup);
      window.removeEventListener("beforeunload", cleanup);
    };

    const apply = (modeToApply) => {
      if (modeToApply === "system") {
        const isDark = preferenceQuery ? preferenceQuery.matches : false;
        root.classList.toggle("dark", isDark);
        root.style.colorScheme = preferenceQuery ? "light dark" : (isDark ? "dark" : "light");
        return;
      }
      root.classList.toggle("dark", modeToApply === "dark");
      root.style.colorScheme = modeToApply;
    };

    const handlePreferenceChange = () => {
      const activeMode = root.getAttribute(attribute) || defaultMode;
      if (activeMode === "system") {
        apply("system");
      }
    };

    const updateFromAttribute = () => {
      if (isCleanedUp) {
        return;
      }

      const activeMode = root.getAttribute(attribute) || defaultMode;
      if (activeMode === "system") {
        if (!removePreferenceListener) {
          removePreferenceListener = addPreferenceListener(handlePreferenceChange);
        }
      } else if (removePreferenceListener) {
        removePreferenceListener();
        removePreferenceListener = null;
      }
      apply(activeMode);
    };

    if (!root.hasAttribute(attribute)) {
      root.setAttribute(attribute, initialMode);
    }

    updateFromAttribute();

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === attribute) {
          updateFromAttribute();
        }
      }
    });

    observer.observe(root, { attributes: true, attributeFilter: [attribute] });
    window.addEventListener("pagehide", cleanup);
    window.addEventListener("beforeunload", cleanup);
  })();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
