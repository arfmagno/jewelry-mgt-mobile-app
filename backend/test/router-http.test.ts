import { describe, expect, it } from "vitest";
import { z } from "zod";
import { authenticate, setVerifier } from "../src/lib/auth";
import { errorResponse, HttpError, parseJsonBody } from "../src/lib/http";
import { Router } from "../src/lib/router";

describe("Router", () => {
  const noop = async () => ({ statusCode: 200, headers: {}, body: "" });
  const router = new Router().on("GET", "/items/:id", noop).on("POST", "/items", noop);

  it("matches paths and decodes params", () => {
    expect(router.match("GET", "/items/a%20b").params).toEqual({ id: "a b" });
    expect(router.match("POST", "/items/").route.method).toBe("POST");
  });

  it("distinguishes 404 from 405", () => {
    expect(() => router.match("GET", "/nope")).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => router.match("DELETE", "/items")).toThrow(expect.objectContaining({ status: 405 }));
  });
});

describe("http helpers", () => {
  it("maps errors to JSON responses", () => {
    expect(errorResponse(new HttpError(409, "conflict", "Nope"))).toMatchObject({ statusCode: 409 });
    const zodErr = z.object({ a: z.string() }).safeParse({}).error;
    expect(errorResponse(zodErr)).toMatchObject({ statusCode: 400 });
    expect(errorResponse(new Error("secret detail"))).toMatchObject({
      statusCode: 500,
      body: expect.not.stringContaining("secret detail"),
    });
  });

  it("parses JSON bodies including base64", () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonBody(Buffer.from('{"a":2}').toString("base64"), true)).toEqual({ a: 2 });
    expect(parseJsonBody(undefined)).toEqual({});
    expect(() => parseJsonBody("{nope")).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe("authenticate", () => {
  it("requires a valid bearer token", async () => {
    setVerifier({
      async verify(token) {
        if (token !== "good") throw new Error("bad");
        return { sub: "user-123" };
      },
    });
    await expect(authenticate("Bearer good")).resolves.toBe("user-123");
    await expect(authenticate("Bearer bad")).rejects.toMatchObject({ status: 401 });
    await expect(authenticate(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(authenticate("Basic abc")).rejects.toMatchObject({ status: 401 });
    setVerifier(undefined);
  });
});
