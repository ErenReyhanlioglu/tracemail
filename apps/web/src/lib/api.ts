// Server-side access to the API. Private data is fetched only here, with the
// browser's session cookie forwarded; it never reaches a visitor's browser
// (CLAUDE.md, Frontend). Next.js holds no authentication logic of its own.
import "server-only";

import { cookies, headers } from "next/headers";

import type { Application, ApplicationPage } from "@/lib/applications";
import { type FailureReason, reasonForStatus } from "@/lib/failures";
import type { DeliveryPanel, RunsPanel, StoragePanel } from "@/lib/panel";
import type { PostingPage } from "@/lib/postings";

const SESSION_COOKIE = "tracemail_session";
// Cloudflare's visitor address, forwarded so the API rate-limits each
// visitor rather than the web server as a whole.
const CLIENT_IP_HEADER = "cf-connecting-ip";
const PAGE_SIZE = 100;

export class NotSignedInError extends Error {}

export class ApiUnavailableError extends Error {
  constructor(
    readonly reason: FailureReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

function apiUrl(path: string): string {
  const base = process.env.TRACEMAIL_API_URL;
  if (!base) {
    throw new Error("TRACEMAIL_API_URL is not set");
  }
  return `${base}${path}`;
}

// Whether the browser sent a session cookie at all. Without one the viewer is
// a visitor, and pages answer without asking the API anything.
export async function hasSession(): Promise<boolean> {
  return (await cookies()).has(SESSION_COOKIE);
}

async function forwardedHeaders(): Promise<Record<string, string>> {
  const session = (await cookies()).get(SESSION_COOKIE);
  const client = (await headers()).get(CLIENT_IP_HEADER);
  return {
    ...(session ? { cookie: `${SESSION_COOKIE}=${session.value}` } : {}),
    ...(client ? { [CLIENT_IP_HEADER]: client } : {}),
  };
}

async function request(path: string): Promise<Response> {
  const forwarded = await forwardedHeaders();
  try {
    return await fetch(apiUrl(path), { headers: forwarded, cache: "no-store" });
  } catch (error) {
    // The API is down or unreachable: the same state as an error answer.
    throw new ApiUnavailableError("unreachable", "API unreachable", { cause: error });
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await request(path);
  if (response.status === 401) {
    throw new NotSignedInError();
  }
  if (!response.ok) {
    throw new ApiUnavailableError(
      reasonForStatus(response.status),
      `API answered ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

// Roles that hold a session (ADR-0005); a visitor holds none.
export type Role = "owner";

interface Me {
  role: Role;
}

// The session's role, or null without a valid session.
export async function fetchRole(): Promise<Role | null> {
  try {
    return (await getJson<Me>("/api/v1/auth/me")).role;
  } catch (error) {
    if (error instanceof NotSignedInError) {
      return null;
    }
    throw error;
  }
}

export async function fetchAllApplications(): Promise<Application[]> {
  const items: Application[] = [];
  for (let page = 1; ; page += 1) {
    const body = await getJson<ApplicationPage>(
      `/api/v1/applications?page=${page}&page_size=${PAGE_SIZE}`,
    );
    items.push(...body.items);
    if (items.length >= body.total || body.items.length === 0) {
      return items;
    }
  }
}

export interface PostingsRequest {
  status: string;
  days: number | null;
  query: string;
  sort: string;
  order: string;
  page: number;
  pageSize: number;
}

export async function fetchPostings(request: PostingsRequest): Promise<PostingPage> {
  const params = new URLSearchParams({
    status: request.status,
    sort: request.sort,
    order: request.order,
    page: String(request.page),
    page_size: String(request.pageSize),
  });
  if (request.days !== null) {
    params.set("days", String(request.days));
  }
  if (request.query) {
    params.set("q", request.query);
  }
  return getJson<PostingPage>(`/api/v1/postings?${params.toString()}`);
}

// The public health panel's parts (ADR-0050); the API caches each, so every
// visit may ask.
const PANEL_PATH = "/api/v1/public/health-panel";

export async function fetchRunsPanel(): Promise<RunsPanel> {
  return getJson<RunsPanel>(`${PANEL_PATH}/runs`);
}

export async function fetchStoragePanel(): Promise<StoragePanel> {
  return getJson<StoragePanel>(`${PANEL_PATH}/storage`);
}

export async function fetchDeliveryPanel(): Promise<DeliveryPanel> {
  return getJson<DeliveryPanel>(`${PANEL_PATH}/delivery`);
}
