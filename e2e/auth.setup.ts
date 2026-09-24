import { expect, test as setup } from "@playwright/test";

import { E2E_LOGIN_SECRET, E2E_ROLES, authFile } from "./env";

// Legt je Rolle eine Session über /api/dev/screenshot-session an (docs/e2e-tests.md).
// Lokal (next dev) ohne Secret, auf Staging mit E2E_LOGIN_SECRET.
for (const role of E2E_ROLES) {
  setup(`Session für ${role}`, async ({ request }) => {
    const response = await request.get(`/api/dev/screenshot-session?role=${role}&mode=json`, {
      headers: E2E_LOGIN_SECRET ? { "x-e2e-login-secret": E2E_LOGIN_SECRET } : {},
      maxRedirects: 0,
    });
    expect(response.status(), await response.text()).toBe(200);
    await request.storageState({ path: authFile(role) });
  });
}
