import { App } from "aws-cdk-lib";
import { GithubOidcStack } from "../lib/github-oidc-stack";
import { JewelryStack } from "../lib/jewelry-stack";

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const required = (name: string) => {
  const v = process.env[name] ?? app.node.tryGetContext(name);
  if (!v) throw new Error(`Set ${name} (environment variable or --context ${name}=...)`);
  return String(v);
};

new JewelryStack(app, "JewelryApp", {
  env,
  cloudflareAccountId: required("CLOUDFLARE_ACCOUNT_ID"),
  r2Bucket: required("R2_BUCKET"),
  alertEmail: process.env.ALERT_EMAIL ?? app.node.tryGetContext("ALERT_EMAIL"),
  description: "Jewelry management app: auth, sync API and records table",
});

const repo = process.env.GITHUB_REPOSITORY ?? app.node.tryGetContext("GITHUB_REPOSITORY");
if (repo) {
  new GithubOidcStack(app, "JewelryGithubDeploy", { env, repository: String(repo) });
}
