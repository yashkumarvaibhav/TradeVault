// Shared (non-test) constants for the e2e auth setup. Kept out of *.setup.ts so spec
// files can import it without Playwright's "test file importing a test file" error.
export const AUTH_STATE = "playwright/.auth/user.json";
