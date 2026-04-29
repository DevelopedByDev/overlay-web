/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authDebug from "../authDebug.js";
import type * as automationRunner from "../automationRunner.js";
import type * as automations from "../automations.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as daytona from "../daytona.js";
import type * as daytonaReconcile from "../daytonaReconcile.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authDebug from "../lib/authDebug.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_storageQuota from "../lib/storageQuota.js";
import type * as lib_stripeOverlaySubscription from "../lib/stripeOverlaySubscription.js";
import type * as mcpServers from "../mcpServers.js";
import type * as memories from "../memories.js";
import type * as memoryExtractor from "../memoryExtractor.js";
import type * as memoryExtractorNode from "../memoryExtractorNode.js";
import type * as notes from "../notes.js";
import type * as outputs from "../outputs.js";
import type * as projects from "../projects.js";
import type * as rateLimits from "../rateLimits.js";
import type * as sessionTransfer from "../sessionTransfer.js";
import type * as skills from "../skills.js";
import type * as storageAdmin from "../storageAdmin.js";
import type * as stripe from "../stripe.js";
import type * as stripeSync from "../stripeSync.js";
import type * as subscriptions from "../subscriptions.js";
import type * as uiSettings from "../uiSettings.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  authDebug: typeof authDebug;
  automationRunner: typeof automationRunner;
  automations: typeof automations;
  conversations: typeof conversations;
  crons: typeof crons;
  daytona: typeof daytona;
  daytonaReconcile: typeof daytonaReconcile;
  files: typeof files;
  http: typeof http;
  knowledge: typeof knowledge;
  "lib/auth": typeof lib_auth;
  "lib/authDebug": typeof lib_authDebug;
  "lib/logging": typeof lib_logging;
  "lib/storageQuota": typeof lib_storageQuota;
  "lib/stripeOverlaySubscription": typeof lib_stripeOverlaySubscription;
  mcpServers: typeof mcpServers;
  memories: typeof memories;
  memoryExtractor: typeof memoryExtractor;
  memoryExtractorNode: typeof memoryExtractorNode;
  notes: typeof notes;
  outputs: typeof outputs;
  projects: typeof projects;
  rateLimits: typeof rateLimits;
  sessionTransfer: typeof sessionTransfer;
  skills: typeof skills;
  storageAdmin: typeof storageAdmin;
  stripe: typeof stripe;
  stripeSync: typeof stripeSync;
  subscriptions: typeof subscriptions;
  uiSettings: typeof uiSettings;
  usage: typeof usage;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
};
