import { sql } from "drizzle-orm";
import { DEAL_STAGES } from "../deal-stages";
import { pgEnum, pgTable, text, timestamp, boolean, date, index, numeric, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("deal_created_at").on(t.createdAt),
  index("deal_by_stage").on(t.stage),
  index("deal_contact_id").on(t.contactId),
  index("deal_company_id").on(t.companyId),
]);
