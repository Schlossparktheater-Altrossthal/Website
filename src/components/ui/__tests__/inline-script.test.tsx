// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InlineScript } from "@/components/ui/inline-script";

describe("InlineScript", () => {
  it("rendert im Browser einen inerten Datenblock statt eines ausführbaren Skripts", () => {
    render(<InlineScript html="window.__inlineScriptRan = true;" />);

    const script = document.querySelector("script");

    expect(script).not.toBeNull();
    expect(script?.getAttribute("type")).toBe("text/plain");
    expect(script?.textContent).toBe("window.__inlineScriptRan = true;");
  });
});
