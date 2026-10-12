import { sql } from "drizzle-orm";
import { ACTIVITY_KINDS } from "../activity-kinds";
import { DEAL_STAGES } from "../deal-stages";
import { TASK_AUTOMATIONS } from "../task-automations";
import { pgEnum, pgTable, text, timestamp, boolean, check, date, index, integer, jsonb, numeric, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────────────────────────
// Better-Auth core tables (names + column shapes match Better-Auth's
// Drizzle adapter expectations as of v1.7.5). Guildhall's own tables
// are added below them, chapter by chapter.
// ──────────────────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  // at most one owner, enforced by the database so two sign-ups at once can't both become it
  uniqueIndex("user_one_owner").on(t.role).where(sql`${t.role} = 'owner'`),
]);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ──────────────────────────────────────────────────────────────────
// Agent sign-in (I5): Better-Auth's jwt() and oauth-provider (through @better-auth/mcp) tables, as its own Drizzle
// schema generator writes them for v1.7.5. Better-Auth reads and writes them; Guildhall's code doesn't.
// ──────────────────────────────────────────────────────────────────

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"),
  alg: text("alg"),
  crv: text("crv"),
});

export const oauthClient = pgTable("oauth_client", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  clientDiscoveryId: text("client_discovery_id"),
  disabled: boolean("disabled").default(false),
  skipConsent: boolean("skip_consent"),
  enableEndSession: boolean("enable_end_session"),
  subjectType: text("subject_type"),
  scopes: text("scopes").array(),
  clientCredentialsScopes: text("client_credentials_scopes").array().default([]),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  name: text("name"),
  uri: text("uri"),
  icon: text("icon"),
  contacts: text("contacts").array(),
  tos: text("tos"),
  policy: text("policy"),
  softwareId: text("software_id"),
  softwareVersion: text("software_version"),
  softwareStatement: text("software_statement"),
  redirectUris: text("redirect_uris").array().notNull(),
  postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
  backchannelLogoutUri: text("backchannel_logout_uri"),
  backchannelLogoutSessionRequired: boolean("backchannel_logout_session_required"),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
  applicationType: text("application_type"),
  jwks: text("jwks"),
  jwksUri: text("jwks_uri"),
  grantTypes: text("grant_types").array(),
  responseTypes: text("response_types").array(),
  requirePKCE: boolean("require_pkce"),
  dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
  referenceId: text("reference_id"),
  metadata: jsonb("metadata"),
}, (t) => [index("oauth_client_user_id_idx").on(t.userId)]);

export const oauthResource = pgTable("oauth_resource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required").default(false),
  disabled: boolean("disabled").default(false),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
});

export const oauthClientResource = pgTable("oauth_client_resource", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull().references(() => oauthResource.identifier, { onDelete: "cascade" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at"),
}, (t) => [
  uniqueIndex("oauth_client_resource_client_id_resource_id_uidx").on(t.clientId, t.resourceId),
  index("oauth_client_resource_resource_id_idx").on(t.resourceId),
]);

export const oauthRefreshToken = pgTable("oauth_refresh_token", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  authorizationCodeId: text("authorization_code_id"),
  resources: text("resources").array(),
  requestedUserInfoClaims: text("requested_user_info_claims").array(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  revoked: timestamp("revoked"),
  rotatedAt: timestamp("rotated_at"),
  rotationReplayResponse: text("rotation_replay_response"),
  rotationReplayExpiresAt: timestamp("rotation_replay_expires_at"),
  authTime: timestamp("auth_time"),
  confirmation: jsonb("confirmation"),
  scopes: text("scopes").array().notNull(),
}, (t) => [
  index("oauth_refresh_token_client_id_idx").on(t.clientId),
  index("oauth_refresh_token_session_id_idx").on(t.sessionId),
  index("oauth_refresh_token_user_id_idx").on(t.userId),
  index("oauth_refresh_token_authorization_code_id_idx").on(t.authorizationCodeId),
]);

export const oauthAccessToken = pgTable("oauth_access_token", {
  id: text("id").primaryKey(),
  token: text("token").unique(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  authorizationCodeId: text("authorization_code_id"),
  resources: text("resources").array(),
  requestedUserInfoClaims: text("requested_user_info_claims").array(),
  refreshId: text("refresh_id").references(() => oauthRefreshToken.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  revoked: timestamp("revoked"),
  confirmation: jsonb("confirmation"),
  scopes: text("scopes").array().notNull(),
}, (t) => [
  index("oauth_access_token_client_id_idx").on(t.clientId),
  index("oauth_access_token_session_id_idx").on(t.sessionId),
  index("oauth_access_token_user_id_idx").on(t.userId),
  index("oauth_access_token_authorization_code_id_idx").on(t.authorizationCodeId),
  index("oauth_access_token_refresh_id_idx").on(t.refreshId),
]);

export const oauthConsent = pgTable("oauth_consent", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  resources: text("resources").array(),
  requestedUserInfoClaims: text("requested_user_info_claims").array(),
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (t) => [
  index("oauth_consent_client_id_idx").on(t.clientId),
  index("oauth_consent_user_id_idx").on(t.userId),
]);

export const oauthClientAssertion = pgTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ──────────────────────────────────────────────────────────────────
// Guildhall
// ──────────────────────────────────────────────────────────────────

// B6: who may sign up after the owner. Emails are stored trimmed and lower-case.
export const allowedEmail = pgTable("allowed_email", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// B8: the businesses those people work for. Optional fields are null when left blank, never "".
export const company = pgTable("company", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  website: text("website"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("company_created_at").on(t.createdAt),
]);

// B7: the people the business deals with. Optional fields are null when left blank, never "".
export const contact = pgTable("contact", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  notes: text("notes"),
  // B8: deleting a company keeps its contacts; they just have no company any more.
  companyId: uuid("company_id").references(() => company.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("contact_created_at").on(t.createdAt),
  index("contact_company_id").on(t.companyId),
]);

// B9: the fixed stages, in order (src/lib/deal-stages.ts).
export const dealStage = pgEnum("deal_stage", DEAL_STAGES);

// B9: work the business hopes to win. Value is exact money, a string in TypeScript; null when not known.
export const deal = pgTable("deal", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }),
  stage: dealStage("stage").notNull().default("New"),
  // deleting the contact or company keeps the deal
  contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => company.id, { onDelete: "set null" }),
  expectedClose: date("expected_close", { mode: "string" }),
  // B11: when an activity was last logged on the deal, its contact or its company; null until one is
  lastActivityAt: timestamp("last_activity_at"),
  // B14: the business's calendar day the deal reached Won; null while it isn't at Won
  wonOn: date("won_on", { mode: "string" }),
  // B15: where the deal came from ("Web form" for enquiries); null for deals added by hand. No form edits it.
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("deal_created_at").on(t.createdAt),
  // the deals won in a month
  index("deal_won_on").on(t.wonOn),
  index("deal_by_stage").on(t.stage),
  index("deal_contact_id").on(t.contactId),
  index("deal_company_id").on(t.companyId),
]);

// B11: what kind of thing happened (src/lib/activity-kinds.ts).
export const activityKind = pgEnum("activity_kind", ACTIVITY_KINDS);

// B11: a note, call, meeting or stage change, on exactly one contact, company or deal; deleted with it.
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: activityKind("kind").notNull(),
  body: text("body").notNull(),
  // who logged it; kept, without a name, if that person is ever removed
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  // who wrote it when no person did ("Web form" for an enquiry's note); null for anything a person logged
  source: text("source"),
  contactId: uuid("contact_id").references(() => contact.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => company.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").references(() => deal.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  check("activity_on_one_record", sql`num_nonnulls(${t.contactId}, ${t.companyId}, ${t.dealId}) = 1`),
  index("activity_contact_id").on(t.contactId, t.createdAt),
  index("activity_company_id").on(t.companyId, t.createdAt),
  index("activity_deal_id").on(t.dealId, t.createdAt),
]);

// B16: the tasks Guildhall adds itself (src/lib/task-automations.ts).
export const taskAutomation = pgEnum("task_automation", TASK_AUTOMATIONS);

// B12: something promised, due on a day, on exactly one contact, company or deal; deleted with it.
export const task = pgTable("task", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  dueOn: date("due_on", { mode: "string" }).notNull(),
  // null while open
  doneAt: timestamp("done_at"),
  contactId: uuid("contact_id").references(() => contact.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => company.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").references(() => deal.id, { onDelete: "cascade" }),
  // B16: which automation added it; null for every task a person adds
  automation: taskAutomation("automation"),
  // B16: on a cold check-in only, the deal's coalesce(last_activity_at, created_at) when it was made: its cold spell
  coldSince: timestamp("cold_since"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  check("task_on_one_record", sql`num_nonnulls(${t.contactId}, ${t.companyId}, ${t.dealId}) = 1`),
  index("task_contact_id").on(t.contactId, t.dueOn),
  index("task_company_id").on(t.companyId, t.dueOn),
  index("task_deal_id").on(t.dealId, t.dueOn),
  // the Tasks page and Home: open tasks due on or before a day
  index("task_open_due_on").on(t.dueOn).where(sql`${t.doneAt} is null`),
  // B16: "once" is the database's job, so two tabs moving a deal to Won together still make one task. Both
  // automations insert with on conflict do nothing against these.
  uniqueIndex("task_one_won_follow_up").on(t.dealId).where(sql`${t.automation} = 'won_follow_up'`),
  uniqueIndex("task_one_check_in_per_cold_spell").on(t.dealId, t.coldSince).where(sql`${t.automation} = 'cold_check_in'`),
  // A check passes when it evaluates to null, so neither may compare a null automation with "=".
  check("task_automation_on_deal", sql`${t.automation} is null or ${t.dealId} is not null`),
  check("task_cold_since_on_check_in",
    sql`(${t.automation} is not distinct from 'cold_check_in') = (${t.coldSince} is not null)`),
]);

// B15: one row per enquiry saved from the web form, counted towards its email's daily limit. Kept when the owner
// deletes the deal, so deleting doesn't reopen the day's allowance.
export const enquiry = pgTable("enquiry", {
  id: uuid("id").primaryKey().defaultRandom(),
  // trimmed and lower-case
  email: text("email").notNull(),
  // the business's calendar day it arrived
  receivedOn: date("received_on", { mode: "string" }).notNull(),
  dealId: uuid("deal_id").references(() => deal.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("enquiry_email_received_on").on(t.email, t.receivedOn),
]);

// I8: one row per change an agent made through a write tool. Read tools record nothing. The agent's name is kept as it
// was, and no key ties the row to the agent or the record, so the log outlives a disconnected agent or a deleted deal.
export const agentLog = pgTable("agent_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  // the agent's OAuth client ID, for the filter
  clientId: text("client_id").notNull(),
  agentName: text("agent_name").notNull(),
  // who the agent acted for; kept, without a name, if that person is ever removed
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  tool: text("tool").notNull(),
  // the one line the tool answered
  summary: text("summary").notNull(),
  // the contact, company or deal the change touched
  recordType: text("record_type").$type<"contact" | "company" | "deal">(),
  recordId: uuid("record_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("agent_log_created_at").on(t.createdAt),
  index("agent_log_client_id").on(t.clientId, t.createdAt),
  check("agent_log_record", sql`(${t.recordType} is null) = (${t.recordId} is null)`),
  check("agent_log_record_type", sql`${t.recordType} in ('contact', 'company', 'deal')`),
]);
