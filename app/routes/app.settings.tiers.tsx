import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  getShopSettings,
  updateShopSettings,
  type TierThresholds,
  type TierConfig,
} from "~/services/loyalty";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await getShopSettings(session.shop);

  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();

  // Parse tier thresholds
  const tierThresholds: TierThresholds = {
    CLUB: parseInt(formData.get("threshold_club") as string) || 1000,
    CLUB_PLUS: parseInt(formData.get("threshold_club_plus") as string) || 5000,
  };

  // Parse tier config
  const tierConfig: TierConfig = {
    LITE: {
      multiplier: parseFloat(formData.get("multiplier_lite") as string) || 1.5,
      academy: (formData.get("academy_lite") as string) || "basic",
    },
    CLUB: {
      multiplier: parseFloat(formData.get("multiplier_club") as string) || 2.0,
      academy: (formData.get("academy_club") as string) || "full",
    },
    CLUB_PLUS: {
      multiplier: parseFloat(formData.get("multiplier_club_plus") as string) || 3.5,
      academy: (formData.get("academy_club_plus") as string) || "premium",
    },
  };

  const milestoneTierBonus = parseInt(formData.get("milestone_tier_bonus") as string) || 100;

  await updateShopSettings(session.shop, {
    tier_thresholds: tierThresholds,
    tier_config: tierConfig,
    milestone_tier_bonus: milestoneTierBonus,
  });

  return { success: true };
};

export default function TiersSettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  const thresholds = settings.tierThresholds;
  const config = settings.tierConfig;

  // Controlled state for form fields
  const [thresholdClub, setThresholdClub] = useState(thresholds.CLUB.toString());
  const [thresholdClubPlus, setThresholdClubPlus] = useState(thresholds.CLUB_PLUS.toString());
  const [multiplierLite, setMultiplierLite] = useState(config.LITE.multiplier.toString());
  const [multiplierClub, setMultiplierClub] = useState(config.CLUB.multiplier.toString());
  const [multiplierClubPlus, setMultiplierClubPlus] = useState(config.CLUB_PLUS.multiplier.toString());
  const [academyLite, setAcademyLite] = useState(config.LITE.academy);
  const [academyClub, setAcademyClub] = useState(config.CLUB.academy);
  const [academyClubPlus, setAcademyClubPlus] = useState(config.CLUB_PLUS.academy);
  const [milestoneTierBonus, setMilestoneTierBonus] = useState(settings.milestone_tier_bonus.toString());

  // Reset form when settings change
  useEffect(() => {
    setThresholdClub(thresholds.CLUB.toString());
    setThresholdClubPlus(thresholds.CLUB_PLUS.toString());
    setMultiplierLite(config.LITE.multiplier.toString());
    setMultiplierClub(config.CLUB.multiplier.toString());
    setMultiplierClubPlus(config.CLUB_PLUS.multiplier.toString());
    setAcademyLite(config.LITE.academy);
    setAcademyClub(config.CLUB.academy);
    setAcademyClubPlus(config.CLUB_PLUS.academy);
    setMilestoneTierBonus(settings.milestone_tier_bonus.toString());
  }, [settings, thresholds, config]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("threshold_club", thresholdClub);
    formData.append("threshold_club_plus", thresholdClubPlus);
    formData.append("multiplier_lite", multiplierLite);
    formData.append("multiplier_club", multiplierClub);
    formData.append("multiplier_club_plus", multiplierClubPlus);
    formData.append("academy_lite", academyLite);
    formData.append("academy_club", academyClub);
    formData.append("academy_club_plus", academyClubPlus);
    formData.append("milestone_tier_bonus", milestoneTierBonus);
    submit(formData, { method: "post" });
  };

  return (
    <s-page heading="Configuration des niveaux VIP">
      <s-button slot="breadcrumb-actions" href="/app/settings" variant="tertiary">
        Retour aux parametres
      </s-button>

      {actionData?.success && (
        <s-banner tone="success" dismissible>
          Configuration des niveaux mise a jour avec succes.
        </s-banner>
      )}

      <s-section heading="Seuils de progression">
        <s-paragraph>
          Definissez le nombre de points lifetime necessaires pour atteindre chaque niveau.
        </s-paragraph>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong">VIP Lite</s-text>
              <s-text color="subdued">Niveau de depart pour tous les membres</s-text>
              <s-badge tone="info">0 points</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong">VIP Club</s-text>
              <s-number-field
                label="Seuil de points pour VIP Club"
                value={thresholdClub}
                min={0}
                step={100}
                onChange={(e) => setThresholdClub(e.target.value)}
              />
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong">VIP Club+</s-text>
              <s-number-field
                label="Seuil de points pour VIP Club+"
                value={thresholdClubPlus}
                min={0}
                step={100}
                onChange={(e) => setThresholdClubPlus(e.target.value)}
              />
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Multiplicateurs de points">
        <s-paragraph>
          Chaque niveau offre un multiplicateur sur les points gagnes lors des achats.
        </s-paragraph>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="large">
              <s-stack direction="block" gap="base">
                <s-badge tone="info">Lite</s-badge>
                <s-number-field
                  label="Multiplicateur"
                  value={multiplierLite}
                  min={1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setMultiplierLite(e.target.value)}
                />
              </s-stack>
              <s-stack direction="block" gap="base">
                <s-badge tone="success">Club</s-badge>
                <s-number-field
                  label="Multiplicateur"
                  value={multiplierClub}
                  min={1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setMultiplierClub(e.target.value)}
                />
              </s-stack>
              <s-stack direction="block" gap="base">
                <s-badge tone="warning">Club+</s-badge>
                <s-number-field
                  label="Multiplicateur"
                  value={multiplierClubPlus}
                  min={1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setMultiplierClubPlus(e.target.value)}
                />
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Acces a l'academie">
        <s-paragraph>
          Definissez le niveau d'acces a l'academie pour chaque niveau VIP.
        </s-paragraph>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="large">
              <s-stack direction="block" gap="base">
                <s-badge tone="info">Lite</s-badge>
                <s-select
                  label="Acces academie"
                  value={academyLite}
                  onChange={(e) => setAcademyLite(e.target.value)}
                >
                  <option value="basic">Basique</option>
                  <option value="full">Complet</option>
                  <option value="premium">Premium</option>
                </s-select>
              </s-stack>
              <s-stack direction="block" gap="base">
                <s-badge tone="success">Club</s-badge>
                <s-select
                  label="Acces academie"
                  value={academyClub}
                  onChange={(e) => setAcademyClub(e.target.value)}
                >
                  <option value="basic">Basique</option>
                  <option value="full">Complet</option>
                  <option value="premium">Premium</option>
                </s-select>
              </s-stack>
              <s-stack direction="block" gap="base">
                <s-badge tone="warning">Club+</s-badge>
                <s-select
                  label="Acces academie"
                  value={academyClubPlus}
                  onChange={(e) => setAcademyClubPlus(e.target.value)}
                >
                  <option value="basic">Basique</option>
                  <option value="full">Complet</option>
                  <option value="premium">Premium</option>
                </s-select>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Bonus de passage de niveau">
        <s-paragraph>
          Points bonus accordes lorsqu'un membre atteint un nouveau niveau.
        </s-paragraph>
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-number-field
            label="Points bonus par niveau atteint"
            value={milestoneTierBonus}
            min={0}
            step={10}
            onChange={(e) => setMilestoneTierBonus(e.target.value)}
          />
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
