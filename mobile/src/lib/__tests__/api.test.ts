import { ApiError, createApiClient } from "../api";

jest.mock("expo-file-system", () => ({ File: jest.fn() }));

function fakeFetch(status: number, body: unknown) {
  return jest.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as jest.Mock & typeof fetch;
}

const client = (fetchImpl: typeof fetch) =>
  createApiClient({ baseUrl: "https://api.example.test", getToken: async () => "token-1", fetchImpl, putFile: jest.fn() });

describe("api client", () => {
  it("sends the bearer token and JSON body", async () => {
    const f = fakeFetch(200, { results: [], serverTime: "2026-01-01T00:00:00.000Z" });
    await client(f).push({ records: [] });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.example.test/sync/push");
    expect(init.headers.Authorization).toBe("Bearer token-1");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ records: [] });
  });

  it("encodes pull parameters", async () => {
    const f = fakeFetch(200, { records: [], cursor: null, serverTime: "x" });
    await client(f).pull({ since: "2026-01-01T00:00:00.000Z", limit: 100 });
    expect(f.mock.calls[0]![0]).toBe("https://api.example.test/sync/pull?since=2026-01-01T00%3A00%3A00.000Z&limit=100");
  });

  it("maps server errors to ApiError with the server code", async () => {
    const f = fakeFetch(429, { error: { code: "ai_quota_exceeded", message: "Daily limit reached" } });
    const err = await client(f).generateDesign({ description: "halo ring" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: "ai_quota_exceeded", message: "Daily limit reached" });
  });

  it("reports network failures as offline", async () => {
    const f = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    await expect(client(f).imageUrls(["k"])).rejects.toMatchObject({ code: "network" });
  });
});
