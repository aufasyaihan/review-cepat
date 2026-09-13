CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp,
	`refresh_token_expires_at` timestamp,
	`scope` text,
	`password` text,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `destination` (
	`id` varchar(36) NOT NULL,
	`device_id` varchar(36) NOT NULL,
	`type` varchar(20) NOT NULL,
	`label` varchar(120),
	`url` varchar(300),
	`place_id` varchar(36),
	`position` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `destination_id` PRIMARY KEY(`id`),
	CONSTRAINT `destination_device_pos_idx` UNIQUE(`device_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `device` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'UNCLAIMED',
	`owner_id` int,
	`claim_code_hash` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `device_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `device_claim_code_hash_unique` UNIQUE(`claim_code_hash`)
);
--> statement-breakpoint
CREATE TABLE `merchant_profile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`business_name` varchar(120) NOT NULL,
	`phone` varchar(30),
	`country` varchar(2),
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `merchant_profile_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchant_profile_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `place` (
	`id` varchar(36) NOT NULL,
	`google_place_id` varchar(128) NOT NULL,
	`name` varchar(200) NOT NULL,
	`formatted_address` varchar(300),
	`website` varchar(300),
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `place_id` PRIMARY KEY(`id`),
	CONSTRAINT `place_google_place_id_unique` UNIQUE(`google_place_id`),
	CONSTRAINT `place_google_id_idx` UNIQUE(`google_place_id`)
);
--> statement-breakpoint
CREATE TABLE `scan_event` (
	`id` varchar(36) NOT NULL,
	`device_id` varchar(36) NOT NULL,
	`destination_id` varchar(36),
	`outcome` varchar(20) NOT NULL,
	`browser` varchar(60),
	`device_type` varchar(20),
	`country` varchar(2),
	`city` varchar(100),
	`referrer` varchar(300),
	`source` varchar(10) NOT NULL DEFAULT 'link',
	`user_agent` text,
	`ip_hash` varchar(64),
	`created_at` timestamp NOT NULL,
	CONSTRAINT `scan_event_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`token` varchar(255) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL,
	`image` text,
	`role` varchar(20) NOT NULL DEFAULT 'MERCHANT',
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `user_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `destination` ADD CONSTRAINT `destination_device_id_device_id_fk` FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `destination` ADD CONSTRAINT `destination_place_id_place_id_fk` FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `device` ADD CONSTRAINT `device_owner_id_merchant_profile_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `merchant_profile`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `merchant_profile` ADD CONSTRAINT `merchant_profile_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scan_event` ADD CONSTRAINT `scan_event_device_id_device_id_fk` FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scan_event` ADD CONSTRAINT `scan_event_destination_id_destination_id_fk` FOREIGN KEY (`destination_id`) REFERENCES `destination`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `destination_place_idx` ON `destination` (`place_id`);--> statement-breakpoint
CREATE INDEX `device_owner_idx` ON `device` (`owner_id`);--> statement-breakpoint
CREATE INDEX `scan_event_device_time_idx` ON `scan_event` (`device_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `scan_event_created_idx` ON `scan_event` (`created_at`);--> statement-breakpoint
CREATE INDEX `scan_event_country_idx` ON `scan_event` (`country`);