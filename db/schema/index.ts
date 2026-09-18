import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

// ---------------------------------------------------------------------------
// Better Auth core tables (user, session, account, verification)
// ---------------------------------------------------------------------------

export const user = mysqlTable('user', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  role: varchar('role', { length: 20 }).notNull().default('MERCHANT'),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const session = mysqlTable('session', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: varchar('active_organization_id', { length: 36 }).references(
    () => organization.id,
    { onDelete: 'set null' },
  ),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const account = mysqlTable('account', {
  id: varchar('id', { length: 36 }).primaryKey(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = mysqlTable('verification', {
  id: varchar('id', { length: 36 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// Better Auth organization plugin tables (merchant = organization)
// ---------------------------------------------------------------------------

export const organization = mysqlTable('organization', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').notNull(),
});

export const member = mysqlTable(
  'member',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [uniqueIndex('member_org_user_idx').on(table.organizationId, table.userId)],
);

export const invitation = mysqlTable(
  'invitation',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 255 }).notNull(),
    status: varchar('status', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    inviterId: varchar('inviter_id', { length: 36 }).notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [index('invitation_org_idx').on(table.organizationId)],
);

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const merchantProfile = mysqlTable('merchant_profile', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  country: varchar('country', { length: 2 }),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const device = mysqlTable(
  'device',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    slug: varchar('slug', { length: 32 }).notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('UNCLAIMED'),
    ownerId: int('owner_id').references(() => merchantProfile.id, {
      onDelete: 'set null',
    }),
    organizationId: varchar('organization_id', { length: 36 }).references(() => organization.id, {
      onDelete: 'set null',
    }),
    memberId: varchar('member_id', { length: 36 }).references(() => member.id, {
      onDelete: 'set null',
    }),
    boundUserId: varchar('bound_user_id', { length: 36 }).references(() => user.id, {
      onDelete: 'set null',
    }),
    claimCodeHash: varchar('claim_code_hash', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('device_owner_idx').on(table.ownerId),
    index('device_org_idx').on(table.organizationId),
    index('device_member_idx').on(table.memberId),
  ],
);

export const place = mysqlTable(
  'place',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    googlePlaceId: varchar('google_place_id', { length: 128 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    formattedAddress: varchar('formatted_address', { length: 300 }),
    website: varchar('website', { length: 300 }),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [uniqueIndex('place_google_id_idx').on(table.googlePlaceId)],
);

export const destination = mysqlTable(
  'destination',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    deviceId: varchar('device_id', { length: 36 })
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(),
    label: varchar('label', { length: 120 }),
    url: varchar('url', { length: 300 }),
    placeId: varchar('place_id', { length: 36 }).references(() => place.id, {
      onDelete: 'set null',
    }),
    position: int('position').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('destination_device_pos_idx').on(table.deviceId, table.position),
    index('destination_place_idx').on(table.placeId),
  ],
);

export const scanEvent = mysqlTable(
  'scan_event',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    deviceId: varchar('device_id', { length: 36 })
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
    destinationId: varchar('destination_id', { length: 36 }).references(() => destination.id, {
      onDelete: 'set null',
    }),
    outcome: varchar('outcome', { length: 20 }).notNull(),
    browser: varchar('browser', { length: 60 }),
    deviceType: varchar('device_type', { length: 20 }),
    country: varchar('country', { length: 2 }),
    city: varchar('city', { length: 100 }),
    referrer: varchar('referrer', { length: 300 }),
    source: varchar('source', { length: 10 }).notNull().default('link'),
    userAgent: text('user_agent'),
    ipHash: varchar('ip_hash', { length: 64 }),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [
    index('scan_event_device_time_idx').on(table.deviceId, table.createdAt),
    index('scan_event_created_idx').on(table.createdAt),
    index('scan_event_country_idx').on(table.country),
  ],
);

export const permission = mysqlTable('permission', {
  id: varchar('id', { length: 36 }).primaryKey(),
  path: varchar('path', { length: 100 }).notNull().unique(),
  label: varchar('label', { length: 120 }).notNull(),
  icon: varchar('icon', { length: 60 }),
  isMenu: boolean('is_menu').notNull().default(false),
  parentId: varchar('parent_id', { length: 36 }),
  sort: int('sort').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const masterRole = mysqlTable('master_role', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 20 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rolePermission = mysqlTable(
  'role_permission',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    roleId: varchar('role_id', { length: 36 })
      .notNull()
      .references(() => masterRole.id, { onDelete: 'cascade' }),
    permissionId: varchar('permission_id', { length: 36 })
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    scope: varchar('scope', { length: 10 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('role_permission_role_perm_scope_idx').on(
      table.roleId,
      table.permissionId,
      table.scope,
    ),
  ],
);
