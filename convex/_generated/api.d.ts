/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_sandbox_daytona from "../ai/sandbox/daytona.js";
import type * as ai_sandbox_daytonaReconcile from "../ai/sandbox/daytonaReconcile.js";
import type * as auth_apiKeys from "../auth/apiKeys.js";
import type * as auth_authDebug from "../auth/authDebug.js";
import type * as auth_serviceAuth from "../auth/serviceAuth.js";
import type * as auth_sessionTransfer from "../auth/sessionTransfer.js";
import type * as auth_users from "../auth/users.js";
import type * as automations_automationRunner from "../automations/automationRunner.js";
import type * as automations_automations from "../automations/automations.js";
import type * as billing_lib_stripeOverlaySubscription from "../billing/lib/stripeOverlaySubscription.js";
import type * as billing_stripe from "../billing/stripe.js";
import type * as billing_stripeSync from "../billing/stripeSync.js";
import type * as billing_subscriptions from "../billing/subscriptions.js";
import type * as chat_conversations from "../chat/conversations.js";
import type * as files_files from "../files/files.js";
import type * as files_lib_storageQuota from "../files/lib/storageQuota.js";
import type * as files_notes from "../files/notes.js";
import type * as files_storageAdmin from "../files/storageAdmin.js";
import type * as integrations_mcpServers from "../integrations/mcpServers.js";
import type * as integrations_skills from "../integrations/skills.js";
import type * as knowledge_knowledge from "../knowledge/knowledge.js";
import type * as knowledge_memories from "../knowledge/memories.js";
import type * as knowledge_memoryExtractor from "../knowledge/memoryExtractor.js";
import type * as knowledge_memoryExtractorNode from "../knowledge/memoryExtractorNode.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authDebug from "../lib/authDebug.js";
import type * as lib_logging from "../lib/logging.js";
import type * as outputs_outputs from "../outputs/outputs.js";
import type * as platform_crons from "../platform/crons.js";
import type * as platform_http from "../platform/http.js";
import type * as platform_idempotency from "../platform/idempotency.js";
import type * as platform_rateLimits from "../platform/rateLimits.js";
import type * as platform_seedDemoAccount from "../platform/seedDemoAccount.js";
import type * as platform_uiSettings from "../platform/uiSettings.js";
import type * as platform_usage from "../platform/usage.js";
import type * as projects_projects from "../projects/projects.js";
import type * as webhooks_deliveries from "../webhooks/deliveries.js";
import type * as webhooks_deliveryRunner from "../webhooks/deliveryRunner.js";
import type * as webhooks_subscriptions from "../webhooks/subscriptions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/sandbox/daytona": typeof ai_sandbox_daytona;
  "ai/sandbox/daytonaReconcile": typeof ai_sandbox_daytonaReconcile;
  "auth/apiKeys": typeof auth_apiKeys;
  "auth/authDebug": typeof auth_authDebug;
  "auth/serviceAuth": typeof auth_serviceAuth;
  "auth/sessionTransfer": typeof auth_sessionTransfer;
  "auth/users": typeof auth_users;
  "automations/automationRunner": typeof automations_automationRunner;
  "automations/automations": typeof automations_automations;
  "billing/lib/stripeOverlaySubscription": typeof billing_lib_stripeOverlaySubscription;
  "billing/stripe": typeof billing_stripe;
  "billing/stripeSync": typeof billing_stripeSync;
  "billing/subscriptions": typeof billing_subscriptions;
  "chat/conversations": typeof chat_conversations;
  "files/files": typeof files_files;
  "files/lib/storageQuota": typeof files_lib_storageQuota;
  "files/notes": typeof files_notes;
  "files/storageAdmin": typeof files_storageAdmin;
  "integrations/mcpServers": typeof integrations_mcpServers;
  "integrations/skills": typeof integrations_skills;
  "knowledge/knowledge": typeof knowledge_knowledge;
  "knowledge/memories": typeof knowledge_memories;
  "knowledge/memoryExtractor": typeof knowledge_memoryExtractor;
  "knowledge/memoryExtractorNode": typeof knowledge_memoryExtractorNode;
  "lib/auth": typeof lib_auth;
  "lib/authDebug": typeof lib_authDebug;
  "lib/logging": typeof lib_logging;
  "outputs/outputs": typeof outputs_outputs;
  "platform/crons": typeof platform_crons;
  "platform/http": typeof platform_http;
  "platform/idempotency": typeof platform_idempotency;
  "platform/rateLimits": typeof platform_rateLimits;
  "platform/seedDemoAccount": typeof platform_seedDemoAccount;
  "platform/uiSettings": typeof platform_uiSettings;
  "platform/usage": typeof platform_usage;
  "projects/projects": typeof projects_projects;
  "webhooks/deliveries": typeof webhooks_deliveries;
  "webhooks/deliveryRunner": typeof webhooks_deliveryRunner;
  "webhooks/subscriptions": typeof webhooks_subscriptions;
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
  stripe: {
    private: {
      handleCheckoutSessionCompleted: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: any;
          mode: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        },
        null
      >;
      handleCustomerCreated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null
      >;
      handleCustomerUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null
      >;
      handleInvoiceCreated: FunctionReference<
        "mutation",
        "internal",
        {
          amountDue: number;
          amountPaid: number;
          created: number;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
        },
        null
      >;
      handleInvoicePaid: FunctionReference<
        "mutation",
        "internal",
        { amountPaid: number; stripeInvoiceId: string },
        null
      >;
      handleInvoicePaymentFailed: FunctionReference<
        "mutation",
        "internal",
        { stripeInvoiceId: string },
        null
      >;
      handlePaymentIntentSucceeded: FunctionReference<
        "mutation",
        "internal",
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
        },
        null
      >;
      handleSubscriptionCreated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
        },
        null
      >;
      handleSubscriptionDeleted: FunctionReference<
        "mutation",
        "internal",
        { stripeSubscriptionId: string },
        null
      >;
      handleSubscriptionUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          priceId?: string;
          quantity?: number;
          status: string;
          stripeSubscriptionId: string;
        },
        null
      >;
      updatePaymentCustomer: FunctionReference<
        "mutation",
        "internal",
        { stripeCustomerId: string; stripePaymentIntentId: string },
        null
      >;
      updateSubscriptionQuantityInternal: FunctionReference<
        "mutation",
        "internal",
        { quantity: number; stripeSubscriptionId: string },
        null
      >;
    };
    public: {
      createOrUpdateCustomer: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        string
      >;
      getCustomer: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        } | null
      >;
      getPayment: FunctionReference<
        "query",
        "internal",
        { stripePaymentIntentId: string },
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        } | null
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { stripeSubscriptionId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null
      >;
      getSubscriptionByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null
      >;
      listInvoices: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listInvoicesByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listInvoicesByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>
      >;
      listPayments: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listPaymentsByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listPaymentsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>
      >;
      listSubscriptions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>
      >;
      listSubscriptionsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>
      >;
      updateSubscriptionMetadata: FunctionReference<
        "mutation",
        "internal",
        {
          metadata: any;
          orgId?: string;
          stripeSubscriptionId: string;
          userId?: string;
        },
        null
      >;
      updateSubscriptionQuantity: FunctionReference<
        "action",
        "internal",
        { apiKey: string; quantity: number; stripeSubscriptionId: string },
        null
      >;
    };
  };
};
