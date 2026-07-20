import { REVENUE_RANKING_GROUPS } from "@/lib/revenue/ranking-groups";

const currentRevenueByArea: Record<string, number> = {
  rayong: 52_321_527.29,
  "laem-chabang": 43_368_875.89,
  chonburi: 42_060_481.83,
  chanthaburi: 34_508_523.41,
  "map-ta-phut": 35_742_890.89,
  chachoengsao: 29_875_957.84,
  pattaya: 29_499_862.57,
  prachinburi: 22_860_987.92,
  "sa-kaeo": 17_067_246.9,
  trat: 14_665_260.91,
  "nakhon-nayok": 9_954_449.31,
};

function metrics(current: number) {
  const previous = current * 0.9;
  const difference = current - previous;
  return {
    currentYtdRevenueBaht: current.toFixed(2),
    previousComparisonRevenueBaht: previous.toFixed(2),
    differenceBaht: difference.toFixed(2),
    differencePercent: ((difference / previous) * 100).toFixed(2),
  };
}

export function createRevenueRankingSourceReport() {
  const sectionRows = REVENUE_RANKING_GROUPS.flatMap((group) =>
    group.areas.map((area) => ({
      key: `section:${area.key}`,
      level: "section" as const,
      unitName: area.unitName,
      sectionName: area.sectionName,
      ...metrics(currentRevenueByArea[area.key]),
    }))
  );
  const currentTotal = Object.values(currentRevenueByArea).reduce((sum, value) => sum + value, 0);

  return {
    reportYear: 2026,
    previousYear: 2025,
    throughMonth: 4,
    hasPreviousYear: true,
    hasComparablePreviousYear: true,
    organization: {
      groupCode: "อป." as const,
      groupName: "ภาคตะวันออก",
      label: "อป. — ภาคตะวันออก",
    },
    rows: [
      ...sectionRows,
      {
        key: "group:op",
        level: "group" as const,
        unitName: null,
        sectionName: null,
        ...metrics(currentTotal),
      },
    ],
  };
}
