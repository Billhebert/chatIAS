-- Add isMaster and masterTenantId fields to User table
ALTER TABLE "User" ADD COLUMN "isMaster" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "masterTenantId" TEXT;
