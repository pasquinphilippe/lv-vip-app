import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopSettings } from "~/services/loyalty";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await getShopSettings(session.shop);

  return { settings };
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();

  const settingsCards = [
    {
      title: "Configuration des niveaux",
      description: "Seuils de points, multiplicateurs et avantages par niveau VIP",
      href: "/app/settings/tiers",
      icon: "tier",
      status: settings.tier_thresholds ? "configured" : "default",
    },
    {
      title: "Gains de points",
      description: "Points par dollar, bonus d'abonnement et réactivation",
      href: "/app/settings/points",
      icon: "points",
      status: "configured",
    },
    {
      title: "Programme de parrainage",
      description: "Récompenses pour parrains et filleuls",
      href: "/app/settings/referrals",
      icon: "referral",
      status: settings.referral_enabled ? "enabled" : "disabled",
    },
    {
      title: "Bonus d'anniversaire",
      description: "Points offerts pendant le mois d'anniversaire",
      href: "/app/settings/birthdays",
      icon: "birthday",
      status: settings.birthday_enabled ? "enabled" : "disabled",
    },
  ];

  return (
    <s-page heading="Paramètres du programme VIP">
      <s-section heading="Configuration générale">
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="large">
              <s-stack direction="block" gap="small">
                <s-text type="strong">Programme fidélité</s-text>
                <s-text color="subdued">
                  {settings.loyalty_enabled
                    ? "Le programme est actif"
                    : "Le programme est désactivé"}
                </s-text>
              </s-stack>
              <s-badge tone={settings.loyalty_enabled ? "success" : "neutral"}>
                {settings.loyalty_enabled ? "Actif" : "Inactif"}
              </s-badge>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Sections de configuration">
        <s-stack direction="block" gap="base">
          {settingsCards.map((card) => (
            <s-box
              key={card.href}
              padding="large"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="inline" gap="large">
                <s-stack direction="block" gap="small">
                  <s-text type="strong">{card.title}</s-text>
                  <s-text color="subdued">{card.description}</s-text>
                </s-stack>
                <s-stack direction="inline" gap="base">
                  {card.status === "enabled" && (
                    <s-badge tone="success">Activé</s-badge>
                  )}
                  {card.status === "disabled" && (
                    <s-badge tone="neutral">Désactivé</s-badge>
                  )}
                  {card.status === "configured" && (
                    <s-badge tone="info">Configuré</s-badge>
                  )}
                  {card.status === "default" && (
                    <s-badge tone="warning">Valeurs par défaut</s-badge>
                  )}
                  <s-button href={card.href} variant="secondary">
                    Configurer
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Résumé de la configuration actuelle">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong">Points</s-text>
              <s-stack direction="inline" gap="large">
                <s-stack direction="block" gap="small">
                  <s-text color="subdued">Points par dollar</s-text>
                  <s-text type="strong">{settings.points_per_dollar}</s-text>
                </s-stack>
                <s-stack direction="block" gap="small">
                  <s-text color="subdued">Bonus bienvenue</s-text>
                  <s-text type="strong">{settings.welcome_bonus} pts</s-text>
                </s-stack>
                <s-stack direction="block" gap="small">
                  <s-text color="subdued">Nouvel abonnement</s-text>
                  <s-text type="strong">{settings.subscription_new_points} pts</s-text>
                </s-stack>
                <s-stack direction="block" gap="small">
                  <s-text color="subdued">Renouvellement</s-text>
                  <s-text type="strong">{settings.subscription_renewal_points} pts</s-text>
                </s-stack>
              </s-stack>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong">Parrainage</s-text>
              <s-stack direction="inline" gap="large">
                <s-stack direction="block" gap="small">
                  <s-text color="subdued">Statut</s-text>
                  <s-badge tone={settings.referral_enabled ? "success" : "neutral"}>
                    {settings.referral_enabled ? "Activé" : "Désactivé"}
                  </s-badge>
                </s-stack>
                {settings.referral_enabled && (
                  <>
                    <s-stack direction="block" gap="small">
                      <s-text color="subdued">Parrain</s-text>
                      <s-text type="strong">{settings.referrer_reward_points} pts</s-text>
                    </s-stack>
                    <s-stack direction="block" gap="small">
                      <s-text color="subdued">Filleul</s-text>
                      <s-text type="strong">{settings.referee_reward_points} pts</s-text>
                    </s-stack>
                  </>
                )}
              </s-stack>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong">Anniversaire</s-text>
              <s-stack direction="inline" gap="large">
                <s-stack direction="block" gap="small">
                  <s-text color="subdued">Statut</s-text>
                  <s-badge tone={settings.birthday_enabled ? "success" : "neutral"}>
                    {settings.birthday_enabled ? "Activé" : "Désactivé"}
                  </s-badge>
                </s-stack>
                {settings.birthday_enabled && (
                  <>
                    <s-stack direction="block" gap="small">
                      <s-text color="subdued">Points</s-text>
                      <s-text type="strong">{settings.birthday_points} pts</s-text>
                    </s-stack>
                    <s-stack direction="block" gap="small">
                      <s-text color="subdued">Fenêtre</s-text>
                      <s-text type="strong">{settings.birthday_window_days} jours</s-text>
                    </s-stack>
                  </>
                )}
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}
