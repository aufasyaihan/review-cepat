ALTER TABLE `device` ADD `organization_id` varchar(36);--> statement-breakpoint
ALTER TABLE `device` ADD `member_id` varchar(36);--> statement-breakpoint
ALTER TABLE `device` ADD `bound_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `session` ADD `active_organization_id` varchar(36);--> statement-breakpoint
ALTER TABLE `device` ADD CONSTRAINT `device_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `device` ADD CONSTRAINT `device_member_id_member_id_fk` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `device` ADD CONSTRAINT `device_bound_user_id_user_id_fk` FOREIGN KEY (`bound_user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_active_organization_id_organization_id_fk` FOREIGN KEY (`active_organization_id`) REFERENCES `organization`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `device_org_idx` ON `device` (`organization_id`);--> statement-breakpoint
CREATE INDEX `device_member_idx` ON `device` (`member_id`);--> statement-breakpoint
ALTER TABLE `invitation` DROP COLUMN `updated_at`;--> statement-breakpoint
ALTER TABLE `member` DROP COLUMN `updated_at`;--> statement-breakpoint
ALTER TABLE `organization` DROP COLUMN `updated_at`;