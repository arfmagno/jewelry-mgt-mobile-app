import * as SecureStore from "expo-secure-store";
import { config } from "./config";

/**
 * Minimal Cognito client over fetch (USER_PASSWORD_AUTH + refresh tokens).
 *
 * The refresh token lives in the device keystore, so once signed in the app keeps
 * working offline indefinitely; a fresh access token is fetched only when syncing.
 */

const REFRESH_KEY = "auth.refreshToken";
const USER_KEY = "auth.username";

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type AuthResult = { AccessToken: string; ExpiresIn: number; RefreshToken?: string };
type InitiateResponse = {
  AuthenticationResult?: AuthResult;
  ChallengeName?: string;
  Session?: string;
};

export type SignInOutcome =
  | { kind: "signed_in" }
  | { kind: "new_password_required"; session: string; username: string };

const FRIENDLY: Record<string, string> = {
  NotAuthorizedException: "Incorrect username or password.",
  UserNotFoundException: "Incorrect username or password.",
  PasswordResetRequiredException: "A password reset is required for this account.",
  InvalidPasswordException: "That password does not meet the requirements.",
  TooManyRequestsException: "Too many attempts. Please wait a moment and try again.",
  LimitExceededException: "Too many attempts. Please wait a moment and try again.",
};

async function cognito<T>(target: string, body: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(`https://cognito-idp.${config.region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError("network", "You appear to be offline.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const type = String(json.__type ?? "Unknown").split("#").pop()!;
    throw new AuthError(type, FRIENDLY[type] ?? String(json.message ?? "Sign-in failed."));
  }
  return json as T;
}

class AuthSession {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshing: Promise<string> | null = null;

  async isSignedIn(): Promise<boolean> {
    return (await SecureStore.getItemAsync(REFRESH_KEY)) !== null;
  }

  async username(): Promise<string | null> {
    return SecureStore.getItemAsync(USER_KEY);
  }

  async signIn(username: string, password: string): Promise<SignInOutcome> {
    const r = await cognito<InitiateResponse>("InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.userPoolClientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    });
    if (r.ChallengeName === "NEW_PASSWORD_REQUIRED" && r.Session) {
      return { kind: "new_password_required", session: r.Session, username };
    }
    await this.accept(username, r.AuthenticationResult);
    return { kind: "signed_in" };
  }

  async completeNewPassword(username: string, newPassword: string, session: string): Promise<void> {
    const r = await cognito<InitiateResponse>("RespondToAuthChallenge", {
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: config.userPoolClientId,
      Session: session,
      ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
    });
    await this.accept(username, r.AuthenticationResult);
  }

  private async accept(username: string, result: AuthResult | undefined) {
    if (!result?.RefreshToken) throw new AuthError("unexpected", "Sign-in did not complete. Please try again.");
    await SecureStore.setItemAsync(REFRESH_KEY, result.RefreshToken);
    await SecureStore.setItemAsync(USER_KEY, username);
    this.setAccess(result);
  }

  private setAccess(result: AuthResult) {
    this.accessToken = result.AccessToken;
    // Renew a minute early to avoid using a token that expires mid-request.
    this.expiresAt = Date.now() + (result.ExpiresIn - 60) * 1000;
  }

  /** A valid access token, refreshing it when needed. */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refresh(): Promise<string> {
    const token = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!token) throw new AuthError("signed_out", "Sign in to sync.");
    try {
      const r = await cognito<InitiateResponse>("InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: config.userPoolClientId,
        AuthParameters: { REFRESH_TOKEN: token },
      });
      if (!r.AuthenticationResult) throw new AuthError("unexpected", "Could not refresh the session.");
      if (r.AuthenticationResult.RefreshToken) {
        await SecureStore.setItemAsync(REFRESH_KEY, r.AuthenticationResult.RefreshToken);
      }
      this.setAccess(r.AuthenticationResult);
      return r.AuthenticationResult.AccessToken;
    } catch (e) {
      if (e instanceof AuthError && e.code === "NotAuthorizedException") {
        await this.signOut();
        throw new AuthError("signed_out", "Your session ended. Sign in again to sync.");
      }
      throw e;
    }
  }

  async signOut(): Promise<void> {
    this.accessToken = null;
    this.expiresAt = 0;
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }
}

export const auth = new AuthSession();
