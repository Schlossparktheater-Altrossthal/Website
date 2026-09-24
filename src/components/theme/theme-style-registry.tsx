import { createTweakcnThemeCss, type TweakcnTheme } from "@/lib/theme/tweakcn";

export function ThemeStyleRegistry({ tokens }: { tokens: TweakcnTheme }) {
  const css = createTweakcnThemeCss(tokens, { resolveFonts: true });
  return (
    <style
      id="website-theme-style"
      data-theme-style="website"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
