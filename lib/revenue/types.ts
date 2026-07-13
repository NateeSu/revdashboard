export type RevenueFilters = {
  unitNames?: string[];
  sectionNames?: string[];
  costCenters?: string[];
  businessGroups?: string[];
  serviceGroups?: string[];
  productCodes?: string[];
  serviceNames?: string[];
};

export type RevenueFilterable = {
  unitName: string;
  sectionName: string;
  costCenter: string;
  businessGroup: string;
  serviceGroup: string;
  productCode: string;
  serviceName: string;
};
