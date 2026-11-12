import * as path from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_budgets as budgets,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

export type JewelryStackProps = StackProps & {
  /** Cloudflare account that owns the R2 bucket and Workers AI. */
  cloudflareAccountId: string;
  r2Bucket: string;
  /** SSM Parameter Store prefix holding the Cloudflare secrets (SecureString). */
  ssmPrefix?: string;
  /** Email for the monthly cost alert; omit to skip creating the budget. */
  alertEmail?: string;
};

/**
 * Everything here stays inside AWS's always-free allowances:
 *  - Cognito (Lite plan), Lambda, a Lambda Function URL (no API Gateway)
 *  - DynamoDB in provisioned mode at 10 RCU / 10 WCU total (free tier: 25 / 25)
 *  - CloudWatch logs with short retention
 */
export class JewelryStack extends Stack {
  constructor(scope: Construct, id: string, props: JewelryStackProps) {
    super(scope, id, props);
    const ssmPrefix = props.ssmPrefix ?? "/jewelry";

    // ── Auth ─────────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, "Users", {
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: false, // single owner; created by an administrator
      signInAliases: { email: true },
      passwordPolicy: { minLength: 12, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const appClient = userPool.addClient("MobileApp", {
      authFlows: { userPassword: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      // Offline-first: the app can stay offline for a long time and still resume syncing.
      refreshTokenValidity: Duration.days(365),
    });

    // ── Data ─────────────────────────────────────────────────────────────
    const table = new dynamodb.Table(this, "Records", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      readCapacity: 5,
      writeCapacity: 5,
    });

    // ── API ──────────────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const api = new nodejs.NodejsFunction(this, "Api", {
      entry: path.join(__dirname, "../../backend/src/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(60), // AI image generation can take several seconds
      logGroup,
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node24",
        externalModules: ["@aws-sdk/*"], // provided by the Lambda runtime
      },
      environment: {
        TABLE_NAME: table.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: appClient.userPoolClientId,
        CLOUDFLARE_ACCOUNT_ID: props.cloudflareAccountId,
        R2_BUCKET: props.r2Bucket,
        SSM_PREFIX: ssmPrefix,
        NODE_OPTIONS: "--enable-source-maps",
      },
    });
    table.grantReadWriteData(api);
    api.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameters"],
        resources: [this.formatArn({ service: "ssm", resource: "parameter", resourceName: `${ssmPrefix.replace(/^\//, "")}/*` })],
      }),
    );

    // JWTs are verified inside the function, so the URL itself is public.
    const url = api.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // ── Cost guardrail ───────────────────────────────────────────────────
    if (props.alertEmail) {
      new budgets.CfnBudget(this, "CostAlert", {
        budget: {
          budgetName: "jewelry-app-monthly",
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: 1, unit: "USD" },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: "ACTUAL",
              comparisonOperator: "GREATER_THAN",
              threshold: 1, // percent of $1 → alerts on the first cent
              thresholdType: "PERCENTAGE",
            },
            subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
          },
        ],
      });
    }

    new CfnOutput(this, "ApiUrl", { value: url.url });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: appClient.userPoolClientId });
    new CfnOutput(this, "Region", { value: this.region });
  }
}
