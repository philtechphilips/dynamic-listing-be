-- AlterTable
ALTER TABLE `news` ADD COLUMN `isHeadline` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `headlineUntil` DATETIME(3) NULL;
