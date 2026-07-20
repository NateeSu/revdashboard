export type RevenueRankingGroupKey = "super-demander" | "star-champion" | "rising-star";

export type RevenueRankingAreaDefinition = {
  key: string;
  label: string;
  unitName: "อป.1" | "อป.2";
  sectionName: string;
  referenceOrder: number;
};

export type RevenueRankingGroupDefinition = {
  key: RevenueRankingGroupKey;
  label: string;
  tier: "L" | "M" | "S";
  referenceOrder: number;
  areas: RevenueRankingAreaDefinition[];
};

export const REVENUE_RANKING_GROUPS: RevenueRankingGroupDefinition[] = [
  {
    key: "super-demander",
    label: "Super Demander",
    tier: "L",
    referenceOrder: 1,
    areas: [
      {
        key: "rayong",
        label: "ระยอง",
        unitName: "อป.2",
        sectionName: "ส่วนขายและบริการลูกค้า ระยอง",
        referenceOrder: 1,
      },
      {
        key: "laem-chabang",
        label: "แหลมฉบัง",
        unitName: "อป.2",
        sectionName: "ส่วนขายและบริการลูกค้า แหลมฉบัง",
        referenceOrder: 2,
      },
      {
        key: "chonburi",
        label: "ชลบุรี",
        unitName: "อป.2",
        sectionName: "ส่วนขายและบริการลูกค้า ชลบุรี",
        referenceOrder: 3,
      },
      {
        key: "chanthaburi",
        label: "จันทบุรี",
        unitName: "อป.1",
        sectionName: "ส่วนขายและบริการลูกค้า จันทบุรี",
        referenceOrder: 4,
      },
    ],
  },
  {
    key: "star-champion",
    label: "Star Champion",
    tier: "M",
    referenceOrder: 2,
    areas: [
      {
        key: "map-ta-phut",
        label: "มาบตาพุด",
        unitName: "อป.2",
        sectionName: "ส่วนขายและบริการลูกค้า มาบตาพุด",
        referenceOrder: 1,
      },
      {
        key: "chachoengsao",
        label: "ฉะเชิงเทรา",
        unitName: "อป.2",
        sectionName: "ส่วนขายและบริการลูกค้า ฉะเชิงเทรา",
        referenceOrder: 2,
      },
      {
        key: "pattaya",
        label: "พัทยา",
        unitName: "อป.2",
        sectionName: "ส่วนขายและบริการลูกค้า เมืองพัทยา",
        referenceOrder: 3,
      },
      {
        key: "prachinburi",
        label: "ปราจีนบุรี",
        unitName: "อป.1",
        sectionName: "ส่วนขายและบริการลูกค้า ปราจีนบุรี",
        referenceOrder: 4,
      },
    ],
  },
  {
    key: "rising-star",
    label: "Rising Star",
    tier: "S",
    referenceOrder: 3,
    areas: [
      {
        key: "sa-kaeo",
        label: "สระแก้ว",
        unitName: "อป.1",
        sectionName: "ส่วนขายและบริการลูกค้า สระแก้ว",
        referenceOrder: 1,
      },
      {
        key: "trat",
        label: "ตราด",
        unitName: "อป.1",
        sectionName: "ส่วนขายและบริการลูกค้า ตราด",
        referenceOrder: 2,
      },
      {
        key: "nakhon-nayok",
        label: "นครนายก",
        unitName: "อป.1",
        sectionName: "ส่วนขายและบริการลูกค้า นครนายก",
        referenceOrder: 3,
      },
    ],
  },
];
