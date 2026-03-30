-- CreateEnum
CREATE TYPE "VaultItemType" AS ENUM ('PASSWORD', 'DOCUMENT', 'NOTE', 'DIGITAL_ASSET', 'OTHER');

-- CreateEnum
CREATE TYPE "TrusteeRole" AS ENUM ('TRUSTEE', 'EXECUTOR');

-- CreateEnum
CREATE TYPE "TrusteeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'DEAD_MAN_SWITCH', 'INACTIVITY');

-- CreateEnum
CREATE TYPE "TriggerStatus" AS ENUM ('ARMED', 'TRIGGERED', 'EXECUTED', 'CANCELLED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('TRUSTEE_INVITED', 'TRUSTEE_ACCEPTED', 'TRUSTEE_REVOKED', 'TRIGGER_ARMED', 'TRIGGER_FIRED', 'TRIGGER_EXECUTED', 'TRIGGER_CANCELLED', 'TRIGGER_OVERRIDDEN', 'TRUSTEE_ACCESS_ACTIVATED', 'TRUSTEE_VIEWED_ITEM', 'OWNER_CHECK_IN', 'DEAD_MAN_SWITCH_WARNING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verify_token" TEXT,
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "last_check_in" TIMESTAMP(3),
    "check_in_interval_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "VaultItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "metadata" JSONB,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "folder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_item_tags" (
    "vault_item_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "vault_item_tags_pkey" PRIMARY KEY ("vault_item_id","tag_id")
);

-- CreateTable
CREATE TABLE "trustees" (
    "id" TEXT NOT NULL,
    "grantor_id" TEXT NOT NULL,
    "trustee_id" TEXT NOT NULL,
    "role" "TrusteeRole" NOT NULL,
    "status" "TrusteeStatus" NOT NULL DEFAULT 'PENDING',
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "access_level" JSONB,
    "activated_at" TIMESTAMP(3),
    "activated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trustees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trustee_item_permissions" (
    "id" TEXT NOT NULL,
    "trustee_id" TEXT NOT NULL,
    "vault_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trustee_item_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_triggers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TriggerType" NOT NULL,
    "status" "TriggerStatus" NOT NULL DEFAULT 'ARMED',
    "delay_days" INTEGER NOT NULL DEFAULT 0,
    "triggered_at" TIMESTAMP(3),
    "executes_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "inactivity_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_verify_token_key" ON "users"("email_verify_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");

-- CreateIndex
CREATE INDEX "vault_items_user_id_idx" ON "vault_items"("user_id");

-- CreateIndex
CREATE INDEX "vault_items_user_id_type_idx" ON "vault_items"("user_id", "type");

-- CreateIndex
CREATE INDEX "vault_items_user_id_folder_id_idx" ON "vault_items"("user_id", "folder_id");

-- CreateIndex
CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_name_key" ON "tags"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "trustees_invite_token_key" ON "trustees"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "trustees_grantor_id_trustee_id_key" ON "trustees"("grantor_id", "trustee_id");

-- CreateIndex
CREATE INDEX "trustee_item_permissions_trustee_id_idx" ON "trustee_item_permissions"("trustee_id");

-- CreateIndex
CREATE UNIQUE INDEX "trustee_item_permissions_trustee_id_vault_item_id_key" ON "trustee_item_permissions"("trustee_id", "vault_item_id");

-- CreateIndex
CREATE INDEX "access_triggers_user_id_idx" ON "access_triggers"("user_id");

-- CreateIndex
CREATE INDEX "access_triggers_status_idx" ON "access_triggers"("status");

-- CreateIndex
CREATE INDEX "audit_logs_owner_id_idx" ON "audit_logs"("owner_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_owner_id_action_idx" ON "audit_logs"("owner_id", "action");

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_tags" ADD CONSTRAINT "vault_item_tags_vault_item_id_fkey" FOREIGN KEY ("vault_item_id") REFERENCES "vault_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_tags" ADD CONSTRAINT "vault_item_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trustees" ADD CONSTRAINT "trustees_grantor_id_fkey" FOREIGN KEY ("grantor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trustees" ADD CONSTRAINT "trustees_trustee_id_fkey" FOREIGN KEY ("trustee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trustee_item_permissions" ADD CONSTRAINT "trustee_item_permissions_trustee_id_fkey" FOREIGN KEY ("trustee_id") REFERENCES "trustees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trustee_item_permissions" ADD CONSTRAINT "trustee_item_permissions_vault_item_id_fkey" FOREIGN KEY ("vault_item_id") REFERENCES "vault_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_triggers" ADD CONSTRAINT "access_triggers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
