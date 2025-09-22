import { createThemeCss } from "@/lib/theme-css";
import type { ThemeTokens } from "@/lib/website-settings";

export function ThemeStyleRegistry({ tokens }: { tokens: ThemeTokens }) {
  const css = createThemeCss(tokens);
  return (
    <style
      id="website-theme-style"
      data-theme-style="website"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
