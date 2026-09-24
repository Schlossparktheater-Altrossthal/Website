/**
 * Kopie von `Theme-Drupal-Sommertheater/src/theme.css` (Stand 262500b).
 * Dient als Preset, damit Mitgliederbereich und Drupal-Website dasselbe Theme nutzen.
 */
export const SOMMERTHEATER_DRUPAL_THEME_CSS = `
:root {
  --paper-surface: #ebd6b4;
  --paper-ink: #0d1715;
  --background: #ffe8d0;
  --foreground: #0d1715;
  --card: #f6e8d3;
  --card-foreground: #0d1715;
  --primary: #e58a08;
  --primary-foreground: #0d1715;
  --secondary: #b68a45;
  --secondary-foreground: #0d1715;
  --muted: #ffd6a7;
  --muted-foreground: #5c4630;
  --accent: #b6ba45;
  --accent-foreground: var(--foreground);
  --destructive: #88452e;
  --destructive-foreground: #ffe8d0;
  --border: #b68a45;
  --input: #b68a45;
  --ring: #e58a08;
  --font-sans: "Outfit", "Helvetica Neue", Arial, Helvetica, sans-serif;
  --font-serif: "Playfair Display", Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: "Fira Mono", "Menlo", "Consolas", "Liberation Mono", monospace;
  --font-body: "Outfit", Arial, Helvetica, sans-serif;
  --radius: 0.5rem;
  --shadow-x: 0;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.2;
  --shadow-color: #5c4630;
  --shadow-2xs: 0 0 3px 0 hsl(30 32% 27% / 0.1);
  --shadow-xs: 0 0 3px 0 hsl(30 32% 27% / 0.1);
  --shadow-sm: 0 0 3px 0 hsl(30 32% 27% / 0.2), 0 1px 2px -1px hsl(30 32% 27% / 0.2);
  --shadow: 0 0 3px 0 hsl(30 32% 27% / 0.2), 0 1px 2px -1px hsl(30 32% 27% / 0.2);
  --shadow-md: 0 0 3px 0 hsl(30 32% 27% / 0.2), 0 2px 4px -1px hsl(30 32% 27% / 0.2);
  --shadow-lg: 0 0 3px 0 hsl(30 32% 27% / 0.2), 0 4px 6px -1px hsl(30 32% 27% / 0.2);
  --shadow-xl: 0 0 3px 0 hsl(30 32% 27% / 0.2), 0 8px 10px -1px hsl(30 32% 27% / 0.2);
  --shadow-2xl: 0 0 3px 0 hsl(30 32% 27% / 0.5);
  --tracking-normal: 0.1em;
  --spacing: 0.25rem;

  --navbar-height: calc(var(--spacing) * 15);

  @media (min-width: 768px) {
    --navbar-height: calc(var(--spacing) * 18);
  }
}

.dark {
  --paper-surface: #ebd6b4;
  --paper-ink: #0d1715;
  --background: #0d1715;
  --foreground: #f6ebd3;
  --card: #182522;
  --card-foreground: #f6ebd3;
  --primary: #e58a08;
  --primary-foreground: #0d1715;
  --secondary: #b68a45;
  --secondary-foreground: #f6ebd3;
  --muted: #1f2e2a;
  --muted-foreground: #c9b89a;
  --accent: #b6ba45;
  --accent-foreground: #0d1715;
  --destructive: #88452e;
  --destructive-foreground: #f6ebd3;
  --border: #4b452e;
  --input: #4b452e;
  --ring: #e58a08;
  --font-sans: "Outfit", "Helvetica Neue", Arial, Helvetica, sans-serif;
  --font-serif: "Playfair Display", Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: "Fira Mono", "Menlo", "Consolas", "Liberation Mono", monospace;
  --radius: 0.5rem;
  --shadow-x: 0;
  --shadow-y: 0;
  --shadow-blur: 3px;
  --shadow-spread: 2px;
  --font-body: "Outfit", Arial, Helvetica, sans-serif;
  --shadow-opacity: 0.1;
  --shadow-color: #000000;
  --shadow-2xs: 0 0 3px 2px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 0 3px 2px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0 0 3px 2px hsl(0 0% 0% / 0.1), 0 1px 2px 1px hsl(0 0% 0% / 0.1);
  --shadow: 0 0 3px 2px hsl(0 0% 0% / 0.1), 0 1px 2px 1px hsl(0 0% 0% / 0.1);
  --shadow-md: 0 0 3px 2px hsl(0 0% 0% / 0.1), 0 2px 4px 1px hsl(0 0% 0% / 0.1);
  --shadow-lg: 0 0 3px 2px hsl(0 0% 0% / 0.1), 0 4px 6px 1px hsl(0 0% 0% / 0.1);
  --shadow-xl: 0 0 3px 2px hsl(0 0% 0% / 0.1), 0 8px 10px 1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0 0 3px 2px hsl(0 0% 0% / 0.25);
}
`;
