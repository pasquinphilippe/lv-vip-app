npm warn Unknown project config "shamefully-hoist". This will stop working in the next major version of npm.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_members" (
    "id" TEXT NOT NULL,
    "shopify_customer_id_coloration" TEXT,
    "shopify_customer_id_haircare" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'LITE',
    "tier_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "birthday_month" INTEGER,
    "birthday_day" INTEGER,
    "quiz_completed_at" TIMESTAMP(3),
    "quiz_routine_result" TEXT,
    "referral_code" TEXT,
    "referred_by" TEXT,
    "referral_count" INTEGER NOT NULL DEFAULT 0,
    "academy_access" TEXT NOT NULL DEFAULT 'basic',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_subscriptions" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "shopify_subscription_id" TEXT,
    "brand" TEXT NOT NULL DEFAULT 'both',
    "status" TEXT NOT NULL DEFAULT 'active',
    "cadence" TEXT NOT NULL DEFAULT '4_weeks',
    "routine_type" TEXT,
    "next_billing_date" TIMESTAMP(3),
    "last_billed_at" TIMESTAMP(3),
    "pause_started_at" TIMESTAMP(3),
    "pause_until" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_points_ledger" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_fr" TEXT,
    "description" TEXT,
    "description_fr" TEXT,
    "type" TEXT NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "discount_value" DECIMAL(10,2),
    "discount_type" TEXT,
    "brand" TEXT NOT NULL DEFAULT 'both',
    "tier_required" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stock_limited" BOOLEAN NOT NULL DEFAULT false,
    "stock_count" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_redemptions" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "shopify_discount_code" TEXT,
    "applied_to_order_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'both',
    "loyalty_enabled" BOOLEAN NOT NULL DEFAULT true,
    "points_per_dollar" INTEGER NOT NULL DEFAULT 1,
    "welcome_bonus" INTEGER NOT NULL DEFAULT 100,
    "subscriptions_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_cadence" TEXT NOT NULL DEFAULT '4_weeks',
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tier_thresholds" JSONB,
    "tier_config" JSONB,
    "milestone_tier_bonus" INTEGER NOT NULL DEFAULT 100,
    "subscription_new_points" INTEGER NOT NULL DEFAULT 50,
    "subscription_renewal_points" INTEGER NOT NULL DEFAULT 25,
    "reactivation_bonus" INTEGER NOT NULL DEFAULT 50,
    "referral_enabled" BOOLEAN NOT NULL DEFAULT false,
    "referrer_reward_points" INTEGER NOT NULL DEFAULT 100,
    "referee_reward_points" INTEGER NOT NULL DEFAULT 50,
    "referral_min_purchase" DECIMAL(10,2),
    "birthday_enabled" BOOLEAN NOT NULL DEFAULT false,
    "birthday_points" INTEGER NOT NULL DEFAULT 100,
    "birthday_window_days" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_events" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referee_id" TEXT NOT NULL,
    "qualifying_order_id" TEXT,
    "referrer_points_awarded" INTEGER,
    "referee_points_awarded" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_claims" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "birthday_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "vip_members_email_key" ON "vip_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vip_members_referral_code_key" ON "vip_members"("referral_code");

-- CreateIndex
CREATE INDEX "vip_members_shopify_customer_id_coloration_idx" ON "vip_members"("shopify_customer_id_coloration");

-- CreateIndex
CREATE INDEX "vip_members_shopify_customer_id_haircare_idx" ON "vip_members"("shopify_customer_id_haircare");

-- CreateIndex
CREATE INDEX "vip_members_email_idx" ON "vip_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vip_subscriptions_shopify_subscription_id_key" ON "vip_subscriptions"("shopify_subscription_id");

-- CreateIndex
CREATE INDEX "vip_subscriptions_member_id_idx" ON "vip_subscriptions"("member_id");

-- CreateIndex
CREATE INDEX "vip_subscriptions_status_idx" ON "vip_subscriptions"("status");

-- CreateIndex
CREATE INDEX "loyalty_points_ledger_member_id_idx" ON "loyalty_points_ledger"("member_id");

-- CreateIndex
CREATE INDEX "loyalty_points_ledger_action_idx" ON "loyalty_points_ledger"("action");

-- CreateIndex
CREATE INDEX "loyalty_points_ledger_expires_at_idx" ON "loyalty_points_ledger"("expires_at");

-- CreateIndex
CREATE INDEX "loyalty_rewards_is_active_idx" ON "loyalty_rewards"("is_active");

-- CreateIndex
CREATE INDEX "loyalty_rewards_brand_idx" ON "loyalty_rewards"("brand");

-- CreateIndex
CREATE INDEX "loyalty_redemptions_member_id_idx" ON "loyalty_redemptions"("member_id");

-- CreateIndex
CREATE INDEX "loyalty_redemptions_status_idx" ON "loyalty_redemptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shop_settings_shop_domain_key" ON "shop_settings"("shop_domain");

-- CreateIndex
CREATE INDEX "referral_events_referrer_id_idx" ON "referral_events"("referrer_id");

-- CreateIndex
CREATE INDEX "referral_events_referee_id_idx" ON "referral_events"("referee_id");

-- CreateIndex
CREATE INDEX "referral_events_status_idx" ON "referral_events"("status");

-- CreateIndex
CREATE INDEX "birthday_claims_member_id_idx" ON "birthday_claims"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "birthday_claims_member_id_year_key" ON "birthday_claims"("member_id", "year");

-- AddForeignKey
ALTER TABLE "vip_subscriptions" ADD CONSTRAINT "vip_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "vip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points_ledger" ADD CONSTRAINT "loyalty_points_ledger_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "vip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "vip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "loyalty_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "vip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "vip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_claims" ADD CONSTRAINT "birthday_claims_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "vip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

