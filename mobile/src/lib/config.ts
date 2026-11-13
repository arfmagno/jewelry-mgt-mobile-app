/**
 * Build-time configuration (EXPO_PUBLIC_* variables are inlined by the bundler).
 * Without an API URL the app runs fully offline: no sign-in and no sync.
 */
export const config = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  region: process.env.EXPO_PUBLIC_AWS_REGION ?? "",
  userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID ?? "",
  /** The public web demo: offline only, filled with sample records on first open. */
  demo: process.env.EXPO_PUBLIC_DEMO === "1",
};

export const isCloudEnabled = () => Boolean(config.apiUrl && config.region && config.userPoolClientId);
