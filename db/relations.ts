import { relations } from 'drizzle-orm';
import {
  account,
  destination,
  device,
  merchantProfile,
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

export const deviceRelations = relations(device, ({ one, many }) => ({
  owner: one(merchantProfile, {
    fields: [device.ownerId],
    references: [merchantProfile.id],
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
