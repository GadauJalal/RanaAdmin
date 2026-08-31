import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side proxy to the Rana54 operations service.
 *
 * With NEXT_PUBLIC_API_BASE_URL=/api the browser talks only to this Next.js
 * server, which forwards to OPERATIONS_API_URL. That keeps the service token
 * off the client and gives the workspace one origin, so no CORS configuration
 * is needed on the backend.
 *
 * If the browser should reach the service directly instead, point
 * NEXT_PUBLIC_API_BASE_URL at the service and these handlers go unused.
 */

export const dynamic = "force-dynamic";

const UPSTREAM = process.env.OPERATIONS_API_URL;
const TOKEN = process.env.OPERATIONS_API_TOKEN;

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
        code: "server_error",
        message:
          "OPERATIONS_API_URL is not configured. Set it, or run with NEXT_PUBLIC_DATA_SOURCE=mock."
      },
      { status: 503 }
    );
  }

  const target = new URL(
    path.map(encodeURIComponent).join("/"),
    UPSTREAM.endsWith("/") ? UPSTREAM : `${UPSTREAM}/`
  );
  target.search = request.nextUrl.search;

  const headers = new Headers();
  headers.set("Accept", "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  // The operator's session travels with the request; the service token
  // identifies this workspace to the backend.
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("Cookie", cookie);
  if (TOKEN) headers.set("Authorization", `Bearer ${TOKEN}`);

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
    console.error("Operations API proxy failed", error);
    return NextResponse.json(
      {
        code: "network_error",
        message: "The operations service could not be reached. No change was recorded."
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
