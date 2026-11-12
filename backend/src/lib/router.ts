import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { HttpError, type JsonResult } from "./http";

export type Method = "GET" | "POST" | "PUT" | "DELETE";

export type RequestContext = {
  event: APIGatewayProxyEventV2;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
  userId: string;
};

export type Handler = (ctx: RequestContext) => Promise<JsonResult>;

type Route = { method: Method; pattern: RegExp; keys: string[]; handler: Handler; public: boolean };

/**
 * Tiny router: one Lambda behind one Function URL keeps cold starts rare for a single user.
 * Path patterns look like "/items/:id".
 */
export class Router {
  private routes: Route[] = [];

  on(method: Method, path: string, handler: Handler, opts: { public?: boolean } = {}): this {
    const keys: string[] = [];
    const source = path.replace(/:([A-Za-z]+)/g, (_match, key: string) => {
      keys.push(key);
      return "([^/]+)";
    });
    const pattern = new RegExp(`^${source}/?$`);
    this.routes.push({ method, pattern, keys, handler, public: opts.public ?? false });
    return this;
  }

  match(method: string, path: string): { route: Route; params: Record<string, string> } {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.pattern.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1] ?? "");
      });
      return { route, params };
    }
    if (pathMatched) throw new HttpError(405, "method_not_allowed", `${method} not allowed on ${path}`);
    throw new HttpError(404, "not_found", `No route for ${method} ${path}`);
  }
}
