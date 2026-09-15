import type { DeviceStatus } from './constants';

export type DeviceSummary = {
  id: string;
  slug: string;
  name: string;
  status: DeviceStatus;
  createdAt: string;
};

export type DestinationDto = {
  id: string;
  type: string;
  label: string | null;
  url: string | null;
  placeId: string | null;
  position: number;
  active: boolean;
};

export type DeviceDetail = DeviceSummary & {
  destinations: DestinationDto[];
};

export type CreateDeviceResult = {
  device: DeviceSummary;
  claimCode: string;
};
