import db from "~/db.server";
import type { vip_members } from "@prisma/client";
import type { ShopSettings } from "./SettingsService";

export interface BirthdayRewardResult {
  awarded: boolean;
  points: number;
  claimId?: string;
  reason?: string;
}

/**
 * Check if a member is within their birthday window
 */
export function isWithinBirthdayWindow(
  member: vip_members,
  windowDays: number
): boolean {
  if (!member.birthday_month || !member.birthday_day) {
    return false;
  }

  const today = new Date();
  const currentYear = today.getFullYear();

  // Create birthday date for this year
  const birthday = new Date(
    currentYear,
    member.birthday_month - 1, // Month is 0-indexed
    member.birthday_day
  );

  // Calculate the window start and end
  const windowStart = new Date(birthday);
  windowStart.setDate(windowStart.getDate() - Math.floor(windowDays / 2));

  const windowEnd = new Date(birthday);
  windowEnd.setDate(windowEnd.getDate() + Math.ceil(windowDays / 2));

  // Check if today is within the window
  return today >= windowStart && today <= windowEnd;
}

/**
 * Check if member has already claimed birthday reward this year
 */
export async function hasClaimedBirthdayThisYear(
  memberId: string
): Promise<boolean> {
  const currentYear = new Date().getFullYear();

  const existingClaim = await db.birthday_claims.findUnique({
    where: {
      member_id_year: {
        member_id: memberId,
        year: currentYear,
      },
    },
  });

  return !!existingClaim;
}

/**
 * Check eligibility and award birthday points
 */
export async function checkAndAwardBirthdayPoints(
  member: vip_members,
  settings: ShopSettings
): Promise<BirthdayRewardResult> {
  const result: BirthdayRewardResult = {
    awarded: false,
    points: 0,
  };

  // Check if birthday rewards are enabled
  if (!settings.birthday_enabled) {
    result.reason = "Birthday rewards are disabled";
    return result;
  }

  // Check if member has birthday set
  if (!member.birthday_month || !member.birthday_day) {
    result.reason = "Member has no birthday set";
    return result;
  }

  // Check if within birthday window
  if (!isWithinBirthdayWindow(member, settings.birthday_window_days)) {
    result.reason = "Not within birthday window";
    return result;
  }

  // Check if already claimed this year
  if (await hasClaimedBirthdayThisYear(member.id)) {
    result.reason = "Already claimed birthday reward this year";
    return result;
  }

  const currentYear = new Date().getFullYear();
  const points = settings.birthday_points;

  // Create birthday claim
  const claim = await db.birthday_claims.create({
    data: {
      member_id: member.id,
      year: currentYear,
      points: points,
    },
  });

  // Award points
  await db.loyalty_points_ledger.create({
    data: {
      member_id: member.id,
      points: points,
      action: "earn_birthday",
      description: `Bonus d'anniversaire ${currentYear}`,
      reference_type: "birthday",
      reference_id: claim.id,
    },
  });

  await db.vip_members.update({
    where: { id: member.id },
    data: {
      points_balance: { increment: points },
      lifetime_points: { increment: points },
    },
  });

  result.awarded = true;
  result.points = points;
  result.claimId = claim.id;

  console.log(`[BirthdayService] Awarded ${points} birthday points to member ${member.id}`);

  return result;
}

/**
 * Get all members eligible for birthday rewards today
 * Useful for scheduled jobs
 */
export async function getMembersWithBirthdayToday(): Promise<vip_members[]> {
  const today = new Date();
  const month = today.getMonth() + 1; // Prisma stores 1-indexed
  const day = today.getDate();

  const members = await db.vip_members.findMany({
    where: {
      birthday_month: month,
      birthday_day: day,
    },
  });

  return members;
}

/**
 * Update member's birthday
 */
export async function updateMemberBirthday(
  memberId: string,
  month: number,
  day: number
): Promise<void> {
  // Validate month and day
  if (month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  if (day < 1 || day > 31) {
    throw new Error("Invalid day");
  }

  // Additional validation for specific months
  const daysInMonth = new Date(2024, month, 0).getDate(); // Use leap year for Feb
  if (day > daysInMonth) {
    throw new Error(`Invalid day ${day} for month ${month}`);
  }

  await db.vip_members.update({
    where: { id: memberId },
    data: {
      birthday_month: month,
      birthday_day: day,
    },
  });
}
