/**
 * Single entry point for every read and write in the workspace.
 *
 * Components import `api` from here and nothing else. Which implementation
 * answers is decided once, from NEXT_PUBLIC_DATA_SOURCE:
 *
 *   mock  (default)  seeded prototype state in the browser
 *   http             the Rana54 operations backend
 *
 * Connecting the backend is therefore a one-line environment change.
 */

import { httpAdapter } from "./http-adapter";
import { mockAdapter } from "./mock-adapter";
import type { OperationsApi } from "./contract";

export type DataSource = "mock" | "http";

export const DATA_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "http" ? "http" : "mock";

export const api: OperationsApi = DATA_SOURCE === "http" ? httpAdapter : mockAdapter;

/** True while the workspace is running on prototype data. */
export const IS_PROTOTYPE_DATA = DATA_SOURCE === "mock";

export * from "./contract";
