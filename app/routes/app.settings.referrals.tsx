import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getShopSettings, updateShopSettings } from "~/services/loyalty";
import prisma from "../db.server";
import { Prisma } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await getShopSettings(session.shop);

  // Get referral stats
  const [totalReferrals, completedReferrals, pendingReferrals] = await Promise.all([
    prisma.referral_events.count(),
    prisma.referral_events.count({ where: { status: "completed" } }),
    prisma.referral_events.count({ where: { status: "pending" } }),
  ]);

  // Get recent referrals
  const recentReferrals = await prisma.referral_events.findMany({
    take: 5,
    orderBy: { created_at: "desc" },
    include: {
      referrer: {
        select: { email: true, first_name: true, last_name: true },
      },
      referee: {
        select: { email: true, first_name: true, last_name: true },
      },
    },
  });

  return {
    settings,
    stats: { totalReferrals, completedReferrals, pendingReferrals },
    recentReferrals,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();

  const minPurchaseValue = formData.get("referral_min_purchase") as string;
  const updates = {
    referral_enabled: formData.get("referral_enabled") === "true",
    referrer_reward_points: parseInt(formData.get("referrer_reward_points") as string) || 100,
    referee_reward_points: parseInt(formData.get("referee_reward_points") as string) || 50,
    referral_min_purchase: minPurchaseValue && parseFloat(minPurchaseValue) > 0
      ? new Prisma.Decimal(minPurchaseValue)
      : null,
  };

  await updateShopSettings(session.shop, updates);

  return { success: true };
};

export default function ReferralsSettingsPage() {
  const { settings, stats, recentReferrals } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  // Controlled state for form fields
  const [referralEnabled, setReferralEnabled] = useState(settings.referral_enabled);
  const [referrerRewardPoints, setReferrerRewardPoints] = useState(settings.referrer_reward_points.toString());
  const [refereeRewardPoints, setRefereeRewardPoints] = useState(settings.referee_reward_points.toString());
  const [referralMinPurchase, setReferralMinPurchase] = useState(settings.referral_min_purchase?.toString() || "0");

  // Reset form when settings change
  useEffect(() => {
    setReferralEnabled(settings.referral_enabled);
    setReferrerRewardPoints(settings.referrer_reward_points.toString());
    setRefereeRewardPoints(settings.referee_reward_points.toString());
    setReferralMinPurchase(settings.referral_min_purchase?.toString() || "0");
  }, [settings]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("referral_enabled", referralEnabled.toString());
    formData.append("referrer_reward_points", referrerRewardPoints);
    formData.append("referee_reward_points", refereeRewardPoints);
    formData.append("referral_min_purchase", referralMinPurchase);
    submit(formData, { method: "post" });
  };

  return (
    <s-page heading="Programme de parrainage">
      <s-button slot="breadcrumb-actions" href="/app/settings" variant="tertiary">
        Retour aux parametres
      </s-button>

      {actionData?.success && (
        <s-banner tone="success" dismissible>
          Configuration du parrainage mise a jour avec succes.
        </s-banner>
      )}

      <s-section heading="Statistiques">
        <s-stack direction="inline" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Total parrainages</s-text>
              <s-text type="strong">{stats.totalReferrals}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Completes</s-text>
              <s-text type="strong">{stats.completedReferrals}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">En attente</s-text>
              <s-text type="strong">{stats.pendingReferrals}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Configuration">
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-checkbox
                label="Activer le programme de parrainage"
                checked={referralEnabled}
                onChange={(e) => setReferralEnabled((e.currentTarget as any).checked)}
              />
              <s-text color="subdued">
                Les membres pourront partager leur code de parrainage et recevoir des recompenses.
              </s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Recompenses">
        <s-paragraph>
          Definissez les points accordes au parrain et au filleul lorsqu'un parrainage est valide.
        </s-paragraph>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="large">
              <s-stack direction="block" gap="base">
                <s-text type="strong">Parrain</s-text>
                <s-text color="subdued">Le membre existant qui invite</s-text>
                <s-number-field
                  label="Points pour le parrain"
                  value={referrerRewardPoints}
                  min={0}
                  step={10}
                  onChange={(e) => setReferrerRewardPoints((e.currentTarget as any).value)}
                />
              </s-stack>
              <s-stack direction="block" gap="base">
                <s-text type="strong">Filleul</s-text>
                <s-text color="subdued">Le nouveau membre invite</s-text>
                <s-number-field
                  label="Points pour le filleul"
                  value={refereeRewardPoints}
                  min={0}
                  step={10}
                  onChange={(e) => setRefereeRewardPoints((e.currentTarget as any).value)}
                />
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Conditions">
        <s-paragraph>
          Definissez les conditions pour qu'un parrainage soit valide.
        </s-paragraph>
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-number-field
              label="Achat minimum du filleul ($)"
              value={referralMinPurchase}
              min={0}
              step={1}
              onChange={(e) => setReferralMinPurchase((e.currentTarget as any).value)}
            />
            <s-text color="subdued">
              Mettez 0 pour valider le parrainage des le premier achat,
              peu importe le montant.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Comment ca fonctionne">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="base">
            <s-text type="strong">1. Code de parrainage</s-text>
            <s-text color="subdued">
              Chaque membre VIP recoit un code unique au format REF-LV[8 caracteres].
              Ce code peut etre partage avec des amis.
            </s-text>

            <s-text type="strong">2. Utilisation du code</s-text>
            <s-text color="subdued">
              Le filleul entre le code dans le champ "Code promo" au checkout.
              Le systeme detecte automatiquement les codes de parrainage.
            </s-text>

            <s-text type="strong">3. Validation</s-text>
            <s-text color="subdued">
              Quand le filleul passe sa premiere commande (respectant le minimum si configure),
              les deux parties recoivent leurs points.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      <s-box padding="large">
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
          </s-button>
          <s-button href="/app/settings" variant="tertiary">
            Annuler
          </s-button>
        </s-stack>
      </s-box>

      {recentReferrals.length > 0 && (
        <s-section heading="Parrainages recents">
          <s-stack direction="block" gap="base">
            {recentReferrals.map((referral) => (
              <s-box
                key={referral.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">
                      {referral.referrer.first_name} {referral.referrer.last_name}
                    </s-text>
                    <s-text color="subdued">vers {referral.referee.email}</s-text>
                  </s-stack>
                  <s-badge
                    tone={referral.status === "completed" ? "success" : "warning"}
                  >
                    {referral.status === "completed" ? "Complete" : "En attente"}
                  </s-badge>
                  {referral.referrer_points_awarded && (
                    <s-text>+{referral.referrer_points_awarded} pts</s-text>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
