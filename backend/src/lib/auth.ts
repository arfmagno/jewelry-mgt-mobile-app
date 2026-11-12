import { CognitoJwtVerifier } from "aws-jwt-verify";
import { env } from "./config";
import { HttpError } from "./http";

type Verifier = { verify(token: string): Promise<{ sub: string }> };

let verifier: Verifier | undefined;

function getVerifier(): Verifier {
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: env.userPoolId,
    clientId: env.userPoolClientId,
    tokenUse: "access",
  });
  return verifier;
}

/** Test hook. */
export function setVerifier(v: Verifier | undefined) {
  verifier = v;
}

/**
 * Lambda Function URLs don't validate JWTs (unlike API Gateway), so we do it here.
 * Returns the Cognito user id (`sub`).
 */
export async function authenticate(authorization: string | undefined): Promise<string> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "unauthorized", "Missing bearer token");
  try {
    const payload = await getVerifier().verify(token);
    return payload.sub;
  } catch {
    throw new HttpError(401, "unauthorized", "Invalid or expired token");
  }
}
