// Percentage points. All verdict and sample-size thresholds live here.
export const rules = {
  lookbackDays: 30,
  minimumHistoryDays: 14,
  legitMaximumGap: 5,
  mehMaximumGap: 15,
  minimumStoreProducts: 5,
} as const;
