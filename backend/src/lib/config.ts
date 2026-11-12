import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const env = {
  get tableName() {
    return required("TABLE_NAME");
  },
  get userPoolId() {
    return required("USER_POOL_ID");
  },
  get userPoolClientId() {
    return required("USER_POOL_CLIENT_ID");
  },
  get cloudflareAccountId() {
    return required("CLOUDFLARE_ACCOUNT_ID");
  },
  get r2Bucket() {
    return required("R2_BUCKET");
  },
  get ssmPrefix() {
    return process.env.SSM_PREFIX ?? "/jewelry";
  },
};

export type Secrets = {
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  cloudflareApiToken: string;
};

let secretsPromise: Promise<Secrets> | undefined;

/**
 * Secrets live in SSM Parameter Store (SecureString, standard tier = free)
 * and are loaded once per Lambda container.
 */
export function getSecrets(ssm = new SSMClient({})): Promise<Secrets> {
  secretsPromise ??= loadSecrets(ssm).catch((e: unknown) => {
    secretsPromise = undefined; // allow a retry on the next invocation
    throw e;
  });
  return secretsPromise;
}

async function loadSecrets(ssm: SSMClient): Promise<Secrets> {
  const p = env.ssmPrefix;
  const names: Record<keyof Secrets, string> = {
    r2AccessKeyId: `${p}/r2-access-key-id`,
    r2SecretAccessKey: `${p}/r2-secret-access-key`,
    cloudflareApiToken: `${p}/cloudflare-api-token`,
  };
  const res = await ssm.send(
    new GetParametersCommand({ Names: Object.values(names), WithDecryption: true }),
  );
  const byName = new Map((res.Parameters ?? []).map((x) => [x.Name, x.Value]));
  const get = (k: keyof Secrets) => {
    const v = byName.get(names[k]);
    if (!v) throw new Error(`Missing SSM parameter ${names[k]}`);
    return v;
  };
  return {
    r2AccessKeyId: get("r2AccessKeyId"),
    r2SecretAccessKey: get("r2SecretAccessKey"),
    cloudflareApiToken: get("cloudflareApiToken"),
  };
}
