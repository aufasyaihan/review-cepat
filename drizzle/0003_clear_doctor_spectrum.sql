CREATE TABLE `permission` (
	`id` varchar(36) NOT NULL,
	`path` varchar(100) NOT NULL,
	`label` varchar(120) NOT NULL,
	`icon` varchar(60),
	`is_menu` boolean NOT NULL DEFAULT false,
	`roles` json NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL,
	CONSTRAINT `permission_id` PRIMARY KEY(`id`),
	CONSTRAINT `permission_path_unique` UNIQUE(`path`)
);
