import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getShopSettings, updateShopSettings } from "~/services/loyalty";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await getShopSettings(session.shop);

  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();

  const updates = {
    loyalty_enabled: formData.get("loyalty_enabled") === "true",
    points_per_dollar: parseInt(formData.get("points_per_dollar") as string) || 1,
    welcome_bonus: parseInt(formData.get("welcome_bonus") as string) || 100,
    subscription_new_points: parseInt(formData.get("subscription_new_points") as string) || 50,
    subscription_renewal_points: parseInt(formData.get("subscription_renewal_points") as string) || 25,
    reactivation_bonus: parseInt(formData.get("reactivation_bonus") as string) || 50,
  };

  await updateShopSettings(session.shop, updates);

  return { success: true };
};

export default function PointsSettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  // Controlled state for form fields
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(settings.loyalty_enabled);
  const [pointsPerDollar, setPointsPerDollar] = useState(settings.points_per_dollar.toString());
  const [welcomeBonus, setWelcomeBonus] = useState(settings.welcome_bonus.toString());
  const [subscriptionNewPoints, setSubscriptionNewPoints] = useState(settings.subscription_new_points.toString());
  const [subscriptionRenewalPoints, setSubscriptionRenewalPoints] = useState(settings.subscription_renewal_points.toString());
  const [reactivationBonus, setReactivationBonus] = useState(settings.reactivation_bonus.toString());

  // Reset form when settings change (after successful save)
  useEffect(() => {
    setLoyaltyEnabled(settings.loyalty_enabled);
    setPointsPerDollar(settings.points_per_dollar.toString());
    setWelcomeBonus(settings.welcome_bonus.toString());
    setSubscriptionNewPoints(settings.subscription_new_points.toString());
    setSubscriptionRenewalPoints(settings.subscription_renewal_points.toString());
    setReactivationBonus(settings.reactivation_bonus.toString());
  }, [settings]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("loyalty_enabled", loyaltyEnabled.toString());
    formData.append("points_per_dollar", pointsPerDollar);
    formData.append("welcome_bonus", welcomeBonus);
    formData.append("subscription_new_points", subscriptionNewPoints);
    formData.append("subscription_renewal_points", subscriptionRenewalPoints);
    formData.append("reactivation_bonus", reactivationBonus);
    submit(formData, { method: "post" });
  };

  // Calculate preview values
  const pointsValue = parseInt(pointsPerDollar) || 1;
  const litePreview = Math.floor(50 * pointsValue * (settings.tierConfig?.LITE?.multiplier || 1.5));
  const clubPreview = Math.floor(50 * pointsValue * (settings.tierConfig?.CLUB?.multiplier || 2.0));
  const clubPlusPreview = Math.floor(50 * pointsValue * (settings.tierConfig?.CLUB_PLUS?.multiplier || 3.5));

  return (
    <s-page heading="Configuration des gains de points">
      <s-button slot="breadcrumb-actions" href="/app/settings" variant="tertiary">
        Retour aux parametres
      </s-button>

      {actionData?.success && (
        <s-banner tone="success" dismissible>
          Configuration des points mise a jour avec succes.
        </s-banner>
      )}

      <s-section heading="Programme fidelite">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-checkbox
              label="Activer le programme de fidelite"
              checked={loyaltyEnabled}
              onChange={(e) => setLoyaltyEnabled((e.currentTarget as HTMLInputElement).checked)}
            />
            <s-text color="subdued">
              Lorsque desactive, aucun point ne sera accorde ou deduit.
            </s-text>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Gains sur les achats">
        <s-paragraph>
          Configurez combien de points de base sont gagnes par dollar depense.
          Le multiplicateur du niveau VIP sera applique automatiquement.
        </s-paragraph>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-number-field
                label="Points de base par dollar"
                value={pointsPerDollar}
                min={1}
                max={10}
                step={1}
                onChange={(e) => setPointsPerDollar((e.currentTarget as HTMLInputElement).value)}
              />
              <s-text color="subdued">
                Exemple: avec 1 point/dollar et un multiplicateur 2x (Club),
                un achat de 50$ rapporte 100 points.
              </s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Bonus de bienvenue">
        <s-paragraph>
          Points accordes aux nouveaux abonnes lors de leur premiere inscription.
        </s-paragraph>
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-number-field
            label="Points de bienvenue"
            value={welcomeBonus}
            min={0}
            step={10}
            onChange={(e) => setWelcomeBonus((e.currentTarget as HTMLInputElement).value)}
          />
        </s-box>
      </s-section>

      <s-section heading="Points d'abonnement">
        <s-paragraph>
          Points accordes lors de la creation et du renouvellement des abonnements.
        </s-paragraph>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="large">
              <s-stack direction="block" gap="base">
                <s-text type="strong">Nouvel abonnement</s-text>
                <s-number-field
                  label="Points pour nouvel abonnement"
                  value={subscriptionNewPoints}
                  min={0}
                  step={5}
                  onChange={(e) => setSubscriptionNewPoints(e.target.value)}
                />
              </s-stack>
              <s-stack direction="block" gap="base">
                <s-text type="strong">Renouvellement</s-text>
                <s-number-field
                  label="Points par renouvellement"
                  value={subscriptionRenewalPoints}
                  min={0}
                  step={5}
                  onChange={(e) => setSubscriptionRenewalPoints(e.target.value)}
                />
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Bonus de reactivation">
        <s-paragraph>
          Points accordes lorsqu'un abonne reactive son abonnement apres une pause.
        </s-paragraph>
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-number-field
            label="Points de reactivation"
            value={reactivationBonus}
            min={0}
            step={10}
            onChange={(e) => setReactivationBonus(e.target.value)}
          />
        </s-box>
      </s-section>

      <s-section heading="Apercu des gains">
        <s-paragraph>
          Voici un exemple de gains pour un achat de 50$ selon le niveau VIP:
        </s-paragraph>
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="inline" gap="large">
            <s-stack direction="block" gap="small">
              <s-badge tone="info">Lite</s-badge>
              <s-text type="strong">{litePreview} pts</s-text>
            </s-stack>
            <s-stack direction="block" gap="small">
              <s-badge tone="success">Club</s-badge>
              <s-text type="strong">{clubPreview} pts</s-text>
            </s-stack>
            <s-stack direction="block" gap="small">
              <s-badge tone="warning">Club+</s-badge>
              <s-text type="strong">{clubPlusPreview} pts</s-text>
            </s-stack>
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
    </s-page>
  );
}
