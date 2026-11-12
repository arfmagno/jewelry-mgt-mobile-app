# Deployment

Everything below stays within always-free tiers: AWS (Lambda, DynamoDB provisioned at 5/5 + 5/5, Cognito Lite, SSM standard parameters, CloudWatch Logs with 14-day retention) and Cloudflare (R2 10 GB, Workers AI daily allowance). A $1 AWS budget alert catches surprises.

## 1. Cloudflare

1. Create an **R2 bucket** (e.g. `jewelry-images`). Leave public access off; the app uses presigned URLs.
2. Create an **R2 API token** with *Object Read & Write* on that bucket. Note its access key ID and secret.
3. Create an **API token** from the *Workers AI* template, which allows running models.
4. Note your **account ID**.

## 2. Secrets in SSM Parameter Store

Standard SecureString parameters are free. Create them in the region you deploy to:

```sh
aws ssm put-parameter --type SecureString --name /jewelry/r2-access-key-id     --value <r2 access key id>
aws ssm put-parameter --type SecureString --name /jewelry/r2-secret-access-key --value <r2 secret>
aws ssm put-parameter --type SecureString --name /jewelry/cloudflare-api-token --value <workers ai token>
```

The Lambda reads them at cold start and caches them in memory.

## 3. First deploy (from a workstation)

```sh
cd infra
npx cdk bootstrap                                   # once per account/region
export CLOUDFLARE_ACCOUNT_ID=<account id>
export R2_BUCKET=jewelry-images
export ALERT_EMAIL=<email for the budget alert>     # optional
export GITHUB_REPOSITORY=<owner>/<repo>             # also creates the CI deploy role
npx cdk deploy --all
```

Stack outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `Region` and `DeployRoleArn`.

Create the single app user (self sign-up is disabled):

```sh
aws cognito-idp admin-create-user --user-pool-id <UserPoolId> --username <email> \
  --user-attributes Name=email,Value=<email> Name=email_verified,Value=true
```

On first sign-in, the app asks the user to replace the temporary password.

## 4. Continuous deployment

GitHub Actions authenticates to AWS with OIDC, so no AWS keys are stored in GitHub. The deploy role trusts only the `main` branch of this repository.

Repository **variables**:

| Variable | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | Role from the `JewelryGithubDeploy` stack |
| `AWS_REGION` | Deployment region |
| `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET`, `ALERT_EMAIL` | As above |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AWS_REGION`, `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | Stack outputs, baked into release APKs |

Optional **secrets** give release APKs a stable signing key (otherwise the debug key is used): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push / PR | typecheck, lint, unit + integration tests, CDK synth, Android JS bundle |
| `deploy.yml` | CI success on `main` | `cdk deploy` via OIDC (skipped until `AWS_DEPLOY_ROLE_ARN` is set) |
| `e2e.yml` | weekly / manual | release APK in offline-only mode + Maestro flows on an emulator |
| `release-apk.yml` | tag `v*` / manual | release APK connected to the backend, attached to the GitHub release |

## 5. The app

For local development against the deployed backend:

```sh
cp mobile/.env.example mobile/.env.local   # fill in ApiUrl, Region, UserPoolClientId
cd mobile && npx expo run:android
```

To install, take the APK from a GitHub release.
