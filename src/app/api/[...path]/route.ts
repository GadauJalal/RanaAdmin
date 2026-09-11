import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side proxy to the Rana54 backend.
 *
 * With NEXT_PUBLIC_API_BASE_URL=/api the browser talks only to this Next.js
 * server, which forwards every /api/<path> request verbatim to the backend at
 * <RANA_API_URL>/<path>. That gives the workspace one origin, so no CORS
 * configuration is needed on the backend.
 *
 * Authentication is the operator's own session: the browser attaches the
 * Bearer access token it received from POST /auth/login, and this proxy
 * forwards that header unchanged. There is no shared service token.
 *
 * The backend mounts routes at the bare root (no /api prefix) and answers
 * every error as { statusCode, code, message }, which is passed through.
 */

export const dynamic = "force-dynamic";

/**
 * RANA_API_URL is the runtime (server-only) setting. NEXT_PUBLIC_RANA_API_URL
 * is an equivalent that Next.js inlines at build time, which lets a Netlify
 * branch context switch a deploy to live with no dashboard configuration.
 */
const UPSTREAM = (process.env.RANA_API_URL || process.env.NEXT_PUBLIC_RANA_API_URL || "").trim();

/** Response headers that belong to the proxied hop, not the payload. */
const HOP_BY_HOP = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
  "upgrade"
]);

async function proxy(request: NextRequest, path: string[]) {
  if (!UPSTREAM) {
    return NextResponse.json(
      {
        statusCode: 503,
        code: "server_error",
        message:
          "RANA_API_URL is not configured. Set it, or run with NEXT_PUBLIC_DATA_SOURCE=mock."
      },
      { status: 503 }
    );
  }

  const base = UPSTREAM.endsWith("/") ? UPSTREAM : `${UPSTREAM}/`;
  const target = new URL(path.map(encodeURIComponent).join("/"), base);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  headers.set("Accept", request.headers.get("accept") ?? "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  // The operator's session travels with the request as a Bearer token.
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
      redirect: "manual"
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) responseHeaders.set(key, value);
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("Rana54 API proxy failed", error);
    return NextResponse.json(
      {
        statusCode: 502,
        code: "network_error",
        message: "The Rana54 backend could not be reached. No change was recorded."
      },
      { status: 502 }
    );
  }
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
