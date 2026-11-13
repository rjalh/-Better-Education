CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`level` text NOT NULL,
	`result` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`verified_by` text,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "achievements_status_check" CHECK("achievements"."status" IN ('pending','verified','rejected'))
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`score` integer NOT NULL,
	`correct` integer NOT NULL,
	`total` integer NOT NULL,
	`answers` text NOT NULL,
	`date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_user_quiz_unique` ON `attempts` (`user_id`,`quiz_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`detail` text NOT NULL,
	`date` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_usage` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`material_id` text NOT NULL,
	`date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `completions_user_material_unique` ON `completions` (`user_id`,`material_id`);--> statement-breakpoint
CREATE TABLE `grades` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`subject` text NOT NULL,
	`score` integer NOT NULL,
	`teacher_id` text NOT NULL,
	`date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "grades_score_check" CHECK("grades"."score" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`title` text NOT NULL,
	`time` text NOT NULL,
	`end_time` text NOT NULL,
	`day` integer NOT NULL,
	`room` text NOT NULL,
	`teacher` text NOT NULL,
	`class_id` text NOT NULL,
	`school_id` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lessons_day_check" CHECK("lessons"."day" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`minutes` integer DEFAULT 5 NOT NULL,
	`class_id` text NOT NULL,
	`school_id` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`label` text NOT NULL,
	`date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_user` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`class_id` text DEFAULT '' NOT NULL,
	`school_id` text DEFAULT 'better-education' NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`stars` integer DEFAULT 0 NOT NULL,
	`last_activity` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" IN ('student','teacher','deputy','director','developer')),
	CONSTRAINT "users_coins_check" CHECK("users"."coins" >= 0)
);

--> statement-breakpoint
-- Keep ledger inserts and balance updates atomic.
CREATE TRIGGER transaction_balance AFTER INSERT ON transactions BEGIN
  UPDATE users SET coins = coins + NEW.amount WHERE id = NEW.user_id;
END;
