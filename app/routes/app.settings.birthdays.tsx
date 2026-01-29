import React from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getShopSettings, updateShopSettings } from "~/services/loyalty";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await getShopSettings(session.shop);

  const currentYear = new Date().getFullYear();

  // Get birthday stats
  const [totalClaims, thisYearClaims, membersWithBirthday] = await Promise.all([
    prisma.birthday_claims.count(),
    prisma.birthday_claims.count({ where: { year: currentYear } }),
    prisma.vip_members.count({
      where: {
        AND: [
          { birthday_month: { not: null } },
          { birthday_day: { not: null } },
        ],
      },
    }),
  ]);

  // Get recent claims
  const recentClaims = await prisma.birthday_claims.findMany({
    take: 5,
    orderBy: { claimed_at: "desc" },
    include: {
      member: {
        select: { email: true, first_name: true, last_name: true, birthday_month: true, birthday_day: true },
      },
    },
  });

  // Get upcoming birthdays (next 7 days)
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const upcomingBirthdays = await prisma.vip_members.findMany({
    where: {
      AND: [
        { birthday_month: { not: null } },
        { birthday_day: { not: null } },
        {
          OR: [
            // Same month, coming days
            {
              birthday_month: currentMonth,
              birthday_day: { gte: currentDay, lte: currentDay + 7 },
            },
            // Next month if we're near end of month
            {
              birthday_month: currentMonth === 12 ? 1 : currentMonth + 1,
              birthday_day: { lte: 7 - (new Date(today.getFullYear(), currentMonth, 0).getDate() - currentDay) },
            },
          ],
        },
      ],
    },
    take: 10,
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      birthday_month: true,
      birthday_day: true,
      tier: true,
    },
  });

  return {
    settings,
    stats: { totalClaims, thisYearClaims, membersWithBirthday },
    recentClaims,
    upcomingBirthdays,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();

  const updates = {
    birthday_enabled: formData.get("birthday_enabled") === "true",
    birthday_points: parseInt(formData.get("birthday_points") as string) || 100,
    birthday_window_days: parseInt(formData.get("birthday_window_days") as string) || 7,
  };

  await updateShopSettings(session.shop, updates);

  return { success: true };
};

export default function BirthdaysSettingsPage() {
  const { settings, stats, recentClaims, upcomingBirthdays } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  // Toast notification on save
  useEffect(() => {
    if (navigation.state === "idle" && actionData?.success) {
      shopify.toast.show("Paramètres anniversaire sauvegardés", { duration: 3000 });
    }
  }, [navigation.state, actionData]);

  // Controlled state for form fields
  const [birthdayEnabled, setBirthdayEnabled] = useState(settings.birthday_enabled);
  const [birthdayPoints, setBirthdayPoints] = useState(settings.birthday_points.toString());
  const [birthdayWindowDays, setBirthdayWindowDays] = useState(settings.birthday_window_days.toString());

  // Reset form when settings change
  useEffect(() => {
    setBirthdayEnabled(settings.birthday_enabled);
    setBirthdayPoints(settings.birthday_points.toString());
    setBirthdayWindowDays(settings.birthday_window_days.toString());
  }, [settings]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("birthday_enabled", birthdayEnabled.toString());
    formData.append("birthday_points", birthdayPoints);
    formData.append("birthday_window_days", birthdayWindowDays);
    submit(formData, { method: "post" });
  };

  const tierLabels: Record<string, string> = {
    LITE: "Lite",
    CLUB: "Club",
    CLUB_PLUS: "Club+",
  };

  const monthNames = [
    "", "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"
  ];

  return (
    <s-page heading="Bonus d'anniversaire">
      <s-button slot="breadcrumb-actions" href="/app/settings" variant="tertiary">
        Retour aux parametres
      </s-button>

      {actionData?.success && (
        <s-banner tone="success" dismissible>
          Configuration des anniversaires mise a jour avec succes.
        </s-banner>
      )}

      <s-section heading="Statistiques">
        <s-stack direction="inline" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Membres avec anniversaire</s-text>
              <s-text type="strong">{stats.membersWithBirthday}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Reclames cette annee</s-text>
              <s-text type="strong">{stats.thisYearClaims}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Total reclames</s-text>
              <s-text type="strong">{stats.totalClaims}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Configuration">
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-checkbox
                label="Activer les bonus d'anniversaire"
                checked={birthdayEnabled}
                onChange={(e) => setBirthdayEnabled((e.currentTarget as any).checked)}
              />
              <s-text color="subdued">
                Les membres recevront des points bonus pendant leur periode d'anniversaire.
              </s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Recompense">
        <s-paragraph>
          Definissez le nombre de points offerts et la fenetre de reclamation.
        </s-paragraph>
        <s-stack direction="block" gap="large">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="large">
              <s-stack direction="block" gap="base">
                <s-text type="strong">Points d'anniversaire</s-text>
                <s-number-field
                  label="Nombre de points"
                  value={birthdayPoints}
                  min={0}
                  step={10}
                  onChange={(e) => setBirthdayPoints((e.currentTarget as any).value)}
                />
              </s-stack>
              <s-stack direction="block" gap="base">
                <s-text type="strong">Fenetre de reclamation</s-text>
                <s-number-field
                  label="Jours autour de l'anniversaire"
                  value={birthdayWindowDays}
                  min={1}
                  max={30}
                  step={1}
                  onChange={(e) => setBirthdayWindowDays((e.currentTarget as any).value)}
                />
                <s-text color="subdued">
                  Nombre de jours avant et apres l'anniversaire ou le bonus peut etre reclame.
                </s-text>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Comment ca fonctionne">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="base">
            <s-text type="strong">Reclamation automatique</s-text>
            <s-text color="subdued">
              Les points sont automatiquement credites lors du premier achat
              pendant la periode d'anniversaire. Le membre ne peut recevoir
              ce bonus qu'une fois par an.
            </s-text>

            <s-text type="strong">Exemple avec une fenetre de 7 jours</s-text>
            <s-text color="subdued">
              Pour un anniversaire le 15 mars, le bonus sera disponible
              du 12 mars au 18 mars (3 jours avant, 3 jours apres).
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

      {upcomingBirthdays.length > 0 && (
        <s-section heading="Anniversaires a venir">
          <s-stack direction="block" gap="base">
            {upcomingBirthdays.map((member) => (
              <s-box
                key={member.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">
                      {member.first_name} {member.last_name}
                    </s-text>
                    <s-text color="subdued">{member.email}</s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="base">
                    <s-text>
                      {member.birthday_day} {monthNames[member.birthday_month || 0]}
                    </s-text>
                    <s-badge tone="info">{tierLabels[member.tier] || member.tier}</s-badge>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}

      {recentClaims.length > 0 && (
        <s-section heading="Reclamations recentes">
          <s-stack direction="block" gap="base">
            {recentClaims.map((claim) => (
              <s-box
                key={claim.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="large">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">
                      {claim.member.first_name} {claim.member.last_name}
                    </s-text>
                    <s-text color="subdued">
                      {claim.member.birthday_day} {monthNames[claim.member.birthday_month || 0]}
                    </s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="base">
                    <s-text type="strong">+{claim.points} pts</s-text>
                    <s-text color="subdued">
                      {new Date(claim.claimed_at).toLocaleDateString("fr-FR")}
                    </s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
