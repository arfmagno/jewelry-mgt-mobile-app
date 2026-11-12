import { auth, AuthError } from "../auth";

const mockKeystore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockKeystore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockKeystore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockKeystore.delete(k)),
}));
jest.mock("../config", () => ({
  config: { apiUrl: "https://api.example.test", region: "ap-southeast-1", userPoolClientId: "client-1" },
  isCloudEnabled: () => true,
}));

type Reply = { status: number; body: unknown };
let replies: Reply[] = [];
const calls: { target: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  mockKeystore.clear();
  replies = [];
  calls.length = 0;
  globalThis.fetch = jest.fn(async (_url: string, init: RequestInit) => {
    calls.push({
      target: (init.headers as Record<string, string>)["X-Amz-Target"]!,
      body: JSON.parse(String(init.body)),
    });
    const r = replies.shift()!;
    return { ok: r.status < 300, status: r.status, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
});

const tokens = (access: string, refresh?: string) => ({
  status: 200,
  body: { AuthenticationResult: { AccessToken: access, ExpiresIn: 3600, ...(refresh ? { RefreshToken: refresh } : {}) } },
});

describe("auth", () => {
  it("signs in with a password and keeps the refresh token in the keystore", async () => {
    replies.push(tokens("access-1", "refresh-1"));
    await expect(auth.signIn("owner@example.com", "pw")).resolves.toEqual({ kind: "signed_in" });
    expect(calls[0]).toMatchObject({
      target: "AWSCognitoIdentityProviderService.InitiateAuth",
      body: { AuthFlow: "USER_PASSWORD_AUTH", ClientId: "client-1" },
    });
    expect(mockKeystore.get("auth.refreshToken")).toBe("refresh-1");
    await expect(auth.getAccessToken()).resolves.toBe("access-1");
    expect(calls).toHaveLength(1); // cached, no refresh
  });

  it("asks for a new password on first sign-in", async () => {
    replies.push({ status: 200, body: { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "sess" } });
    const r = await auth.signIn("owner@example.com", "temp");
    expect(r).toEqual({ kind: "new_password_required", session: "sess", username: "owner@example.com" });

    replies.push(tokens("access-2", "refresh-2"));
    await auth.completeNewPassword("owner@example.com", "a-better-password", "sess");
    expect(calls[1]).toMatchObject({
      target: "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
      body: { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "sess" },
    });
    expect(await auth.isSignedIn()).toBe(true);
  });

  it("shows a friendly message for wrong credentials", async () => {
    replies.push({ status: 400, body: { __type: "NotAuthorizedException", message: "Incorrect username or password." } });
    const err = await auth.signIn("owner@example.com", "nope").catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.message).toBe("Incorrect username or password.");
  });

  it("signs out locally when the refresh token is revoked", async () => {
    mockKeystore.set("auth.refreshToken", "revoked");
    await auth.signOut(); // drop any cached access token
    mockKeystore.set("auth.refreshToken", "revoked");
    replies.push({ status: 400, body: { __type: "NotAuthorizedException", message: "Refresh Token has been revoked" } });
    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: "signed_out" });
    expect(await auth.isSignedIn()).toBe(false);
  });
});
