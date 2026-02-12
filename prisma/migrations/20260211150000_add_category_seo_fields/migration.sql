-- AlterTable
ALTER TABLE `categories` ADD COLUMN `customHeading` VARCHAR(191) NULL,
    ADD COLUMN `seoTitle` VARCHAR(191) NULL,
    ADD COLUMN `seoDescription` TEXT NULL,
    ADD COLUMN `seoKeywords` VARCHAR(191) NULL;
