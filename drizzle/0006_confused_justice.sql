CREATE TABLE `master_role` (
	`id` varchar(36) NOT NULL,
	`name` varchar(20) NOT NULL,
	`description` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_role_id` PRIMARY KEY(`id`),
	CONSTRAINT `master_role_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `role_permission` (
	`id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`permission_id` varchar(36) NOT NULL,
	`scope` varchar(10),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_permission_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_permission_role_perm_scope_idx` UNIQUE(`role_id`,`permission_id`,`scope`)
);
--> statement-breakpoint
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_role_id_master_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `master_role`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_permission_id_permission_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `permission` DROP COLUMN `roles`;