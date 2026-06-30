import { pgTable, serial, varchar, text, boolean, date, integer, numeric, timestamp } from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────
// MITGLIEDER
// ─────────────────────────────────────────────
export const members = pgTable("members", {
  id:                   serial("id").primaryKey(),
  lastName:             varchar("last_name", { length: 100 }).notNull(),
  firstName:            varchar("first_name", { length: 100 }).notNull(),
  street:               varchar("street", { length: 150 }),
  zip:                  varchar("zip", { length: 10 }),
  city:                 varchar("city", { length: 100 }),
  birthDate:            date("birth_date"),
  phoneLandline:        varchar("phone_landline", { length: 30 }),
  phoneMobile:          varchar("phone_mobile", { length: 30 }),
  email:                varchar("email", { length: 150 }),
  // Vereinsfunktion: kommagetrennt, z.B. "KW,SW" — M / 1.V / 2.V / KW / SW / KS / B1 / B2 / B3 / KP1 / KP2
  function:             text("function").default("M").notNull(),
  joinedAt:             date("joined_at"),
  leftAt:               date("left_at"),
  deceased:             boolean("deceased").default(false).notNull(),
  isActive:             boolean("is_active").default(true).notNull(),
  feePaidCurrentYear:   boolean("fee_paid_current_year").default(false).notNull(),
  feeNotes:             text("fee_notes"),
  notes:                text("notes"),
  createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// GÄSTE
// ─────────────────────────────────────────────
export const guests = pgTable("guests", {
  id:          serial("id").primaryKey(),
  lastName:    varchar("last_name", { length: 100 }).notNull(),
  firstName:   varchar("first_name", { length: 100 }).notNull(),
  contactInfo: text("contact_info"),   // Freies Textfeld: Tel., E-Mail, Adresse
  notes:       text("notes"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// EXTERNE KONTEN (max. 5: Barkasse, Bankkonten ...)
// ─────────────────────────────────────────────
export const externalAccounts = pgTable("external_accounts", {
  id:             serial("id").primaryKey(),
  name:           varchar("name", { length: 100 }).notNull(),
  // account_type: 'cash' | 'bank' | 'savings'
  accountType:    varchar("account_type", { length: 20 }),
  iban:           varchar("iban", { length: 34 }),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder:      integer("sort_order").default(0).notNull(),
  isActive:       boolean("is_active").default(true).notNull(),
  notes:          text("notes"),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// INTERNE KONTEN (Nummernkreis 100-999)
// ─────────────────────────────────────────────
export const internalAccounts = pgTable("internal_accounts", {
  id:          serial("id").primaryKey(),
  number:      integer("number").notNull().unique(),  // 100-999
  name:        varchar("name", { length: 150 }).notNull(),
  // account_kind: 'income' | 'expense' | 'neutral' | 'transfer' | 'cancel'
  accountKind: varchar("account_kind", { length: 20 }),
  isActive:    boolean("is_active").default(true).notNull(),
  notes:       text("notes"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// BUCHUNGSJAHRE
// ─────────────────────────────────────────────
export const fiscalYears = pgTable("fiscal_years", {
  id:            serial("id").primaryKey(),
  label:         varchar("label", { length: 50 }).notNull(),   // z.B. "2026"
  dateFrom:      date("date_from").notNull(),
  dateTo:        date("date_to").notNull(),
  isActive:      boolean("is_active").default(false).notNull(),
  isClosed:      boolean("is_closed").default(false).notNull(),
  notes:         text("notes"),
  membershipFee: numeric("membership_fee", { precision: 10, scale: 2 }),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// BUCHUNGEN
// ─────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id:                serial("id").primaryKey(),
  // Fachliche Belegnummer z.B. '2026-0001' — getrennt von technischer ID
  receiptNumber:     varchar("receipt_number", { length: 50 }),
  bookingDate:       date("booking_date").notNull(),
  fiscalYearId:      integer("fiscal_year_id").notNull().references(() => fiscalYears.id),
  amount:            numeric("amount", { precision: 12, scale: 2 }).notNull(),
  // direction: 'in' = Einnahme | 'out' = Ausgabe
  direction:         varchar("direction", { length: 10 }).notNull(),
  externalAccountId: integer("external_account_id").notNull().references(() => externalAccounts.id),
  internalAccountId: integer("internal_account_id").notNull().references(() => internalAccounts.id),
  memberId:          integer("member_id").references(() => members.id),
  travelId:          integer("travel_id").references(() => travels.id),
  // Referenz auf eine andere Buchungs-Nr. (z.B. bei Umbuchungen, Rückvergütungen)
  referenceBookingNo: varchar("reference_booking_no", { length: 50 }),
  description:       text("description"),
  createdBy:         integer("created_by").notNull(),  // FK users (Better Auth)
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// SCAN-BELEGE
// ─────────────────────────────────────────────
export const receipts = pgTable("receipts", {
  id:            serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().references(() => transactions.id),
  fileName:      varchar("file_name", { length: 255 }).notNull(),
  // storage_type: 'local' | 'nas' | 'cloud'
  storageType:   varchar("storage_type", { length: 20 }).default("local").notNull(),
  filePath:      text("file_path").notNull(),  // lokaler Pfad ODER spätere Cloud-URL
  fileType:      varchar("file_type", { length: 20 }),  // 'pdf' | 'jpg' | 'png'
  fileSize:      integer("file_size"),  // Bytes
  uploadedBy:    integer("uploaded_by").notNull(),
  uploadedAt:    timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  notes:         text("notes"),
});

// ─────────────────────────────────────────────
// REISEN
// ─────────────────────────────────────────────
export const travels = pgTable("travels", {
  id:              serial("id").primaryKey(),
  name:            varchar("name", { length: 150 }).notNull(),
  travelDate:      date("travel_date"),
  dateFrom:        date("date_from"),
  dateTo:          date("date_to"),
  destination:     varchar("destination", { length: 150 }),
  totalCost:       numeric("total_cost", { precision: 12, scale: 2 }),
  ownContribution: numeric("own_contribution", { precision: 12, scale: 2 }),
  minParticipants: integer("min_participants").default(0),
  maxParticipants: integer("max_participants"),
  description:     text("description"),
  fiscalYearId:    integer("fiscal_year_id").references(() => fiscalYears.id),
  // status: 'planning' | 'confirmed' | 'completed' | 'cancelled'
  status:          varchar("status", { length: 20 }).default("planning").notNull(),
  notes:           text("notes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// REISE-TEILNEHMER (Mitglieder + Gäste)
// ─────────────────────────────────────────────
export const travelParticipants = pgTable("travel_participants", {
  id:           serial("id").primaryKey(),
  travelId:     integer("travel_id").notNull().references(() => travels.id),
  // Entweder memberId ODER guestId — nie beide (CHECK-Constraint siehe Migration)
  memberId:     integer("member_id").references(() => members.id),
  guestId:      integer("guest_id").references(() => guests.id),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
  isRegistered: boolean("is_registered").notNull().default(true),
  isPaid:       boolean("is_paid").notNull().default(false),
  paidAmount:   numeric("paid_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  paidAt:       date("paid_at"),
  notes:        text("notes"),
});

// ─────────────────────────────────────────────
// UMFRAGEN (für Reisewahl)
// ─────────────────────────────────────────────
export const surveys = pgTable("surveys", {
  id:        serial("id").primaryKey(),
  title:     varchar("title", { length: 150 }).notNull(),
  // status: 'open' | 'closed'
  status:    varchar("status", { length: 20 }).default("open").notNull(),
  closesAt:  date("closes_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const surveyOptions = pgTable("survey_options", {
  id:         serial("id").primaryKey(),
  surveyId:   integer("survey_id").notNull().references(() => surveys.id),
  optionText: varchar("option_text", { length: 200 }).notNull(),
  sortOrder:  integer("sort_order").default(0).notNull(),
});

export const surveyVotes = pgTable("survey_votes", {
  id:       serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveys.id),
  optionId: integer("option_id").notNull().references(() => surveyOptions.id),
  memberId: integer("member_id").references(() => members.id),
  userId:   text("user_id"),
  votedAt:  timestamp("voted_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// BETTER AUTH TABELLEN
// ─────────────────────────────────────────────
export const user = pgTable("user", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image:         text("image"),
  role:          text("role").notNull().default("member"),
  userFunction:  varchar("function", { length: 100 }).default("M"),
  banned:        boolean("banned").notNull().default(false),
  username:      varchar("username", { length: 50 }).unique(),
  approved:      boolean("approved").notNull().default(false),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id:        text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token:     text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId:    text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id:                     text("id").primaryKey(),
  accountId:              text("account_id").notNull(),
  providerId:             text("provider_id").notNull(),
  userId:                 text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken:            text("access_token"),
  refreshToken:           text("refresh_token"),
  idToken:                text("id_token"),
  accessTokenExpiresAt:   timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt:  timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope:                  text("scope"),
  password:               text("password"),
  createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// EINSTELLUNGEN
// ─────────────────────────────────────────────
export const settings = pgTable("settings", {
  id:          serial("id").primaryKey(),
  key:         varchar("key", { length: 100 }).notNull().unique(),
  value:       text("value"),
  description: text("description"),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
