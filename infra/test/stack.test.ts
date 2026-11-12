import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { GithubOidcStack } from "../lib/github-oidc-stack";
import { JewelryStack } from "../lib/jewelry-stack";

describe("JewelryStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new JewelryStack(app, "Test", {
      cloudflareAccountId: "cf-account",
      r2Bucket: "jewelry-images",
      alertEmail: "alerts@example.com",
    });
    template = Template.fromStack(stack);
  }, 120_000);

  it("keeps DynamoDB within the always-free provisioned capacity", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    let rcu = 0;
    let wcu = 0;
    for (const t of Object.values(tables)) {
      const p = t.Properties;
      expect(p.BillingMode ?? "PROVISIONED").toBe("PROVISIONED");
      rcu += p.ProvisionedThroughput.ReadCapacityUnits;
      wcu += p.ProvisionedThroughput.WriteCapacityUnits;
      for (const gsi of p.GlobalSecondaryIndexes ?? []) {
        rcu += gsi.ProvisionedThroughput.ReadCapacityUnits;
        wcu += gsi.ProvisionedThroughput.WriteCapacityUnits;
      }
    }
    expect(rcu).toBeLessThanOrEqual(25);
    expect(wcu).toBeLessThanOrEqual(25);
  });

  it("does not use paid-by-default services", () => {
    for (const type of [
      "AWS::ApiGateway::RestApi",
      "AWS::ApiGatewayV2::Api",
      "AWS::EC2::NatGateway",
      "AWS::RDS::DBInstance",
      "AWS::SecretsManager::Secret",
      "AWS::S3::Bucket",
    ]) {
      template.resourceCountIs(type, 0);
    }
  });

  it("protects data from accidental deletion", () => {
    template.hasResource("AWS::DynamoDB::Table", {
      DeletionPolicy: "Retain",
      Properties: Match.objectLike({ DeletionProtectionEnabled: true }),
    });
    template.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
  });

  it("disables self sign-up on the user pool", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
    });
  });

  it("exposes the API through a Function URL on arm64 Node 22", () => {
    template.hasResourceProperties("AWS::Lambda::Url", { AuthType: "NONE" });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Architectures: ["arm64"],
      Environment: {
        Variables: Match.objectLike({ CLOUDFLARE_ACCOUNT_ID: "cf-account", R2_BUCKET: "jewelry-images" }),
      },
    });
  });

  it("retains logs only briefly", () => {
    template.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 14 });
  });

  it("creates a $1 budget alert when an email is given", () => {
    template.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 1, Unit: "USD" } }),
    });
  });
});

describe("GithubOidcStack", () => {
  it("only trusts the main branch of the given repository", () => {
    const stack = new GithubOidcStack(new App(), "Oidc", { repository: "someone/jewelry" });
    Template.fromStack(stack).hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Condition: {
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                "token.actions.githubusercontent.com:sub": "repo:someone/jewelry:ref:refs/heads/main",
              },
            },
          }),
        ],
      },
    });
  });
});
