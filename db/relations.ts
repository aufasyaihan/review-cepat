import { relations } from 'drizzle-orm';
import {
  account,
  destination,
  device,
  invitation,
  member,
  merchantProfile,
  organization,
  place,
  scanEvent,
  session,
  user,
} from './schema';

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  merchantProfile: one(merchantProfile, {
    fields: [user.id],
    references: [merchantProfile.userId],
  }),
  memberships: many(member),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const merchantProfileRelations = relations(merchantProfile, ({ one, many }) => ({
  user: one(user, { fields: [merchantProfile.userId], references: [user.id] }),
  devices: many(device),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
}));

export const deviceRelations = relations(device, ({ one, many }) => ({
  owner: one(merchantProfile, {
    fields: [device.ownerId],
    references: [merchantProfile.id],
  }),
  organization: one(organization, {
    fields: [device.organizationId],
    references: [organization.id],
  }),
  assignedMember: one(member, {
    fields: [device.memberId],
    references: [member.id],
  }),
  boundUser: one(user, {
    fields: [device.boundUserId],
    references: [user.id],
  }),
  destinations: many(destination),
  scanEvents: many(scanEvent),
}));

export const placeRelations = relations(place, ({ many }) => ({
  destinations: many(destination),
}));

export const destinationRelations = relations(destination, ({ one }) => ({
  device: one(device, { fields: [destination.deviceId], references: [device.id] }),
  place: one(place, { fields: [destination.placeId], references: [place.id] }),
}));

export const scanEventRelations = relations(scanEvent, ({ one }) => ({
  device: one(device, { fields: [scanEvent.deviceId], references: [device.id] }),
  destination: one(destination, {
    fields: [scanEvent.destinationId],
    references: [destination.id],
  }),
}));
