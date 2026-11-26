export const config = {
  sentinel: {
    statisticsUrl: process.env.SENTINEL_STATISTICS_URL ?? 'https://sh.dataspace.copernicus.eu/api/v1/statistics',
    processUrl: process.env.SENTINEL_PROCESS_URL ?? 'https://sh.dataspace.copernicus.eu/api/v1/process',
    catalogUrl: process.env.SENTINEL_CATALOG_URL ?? 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search',
    authUrl: process.env.SENTINEL_AUTH_URL ?? 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    clientId: process.env.SENTINEL_CLIENT_ID || '',
    clientSecret: process.env.SENTINEL_CLIENT_SECRET || '',
  },
  scan: {
    cloudThreshold: 15,
    sarIntervalDays: 6,
    intensiveIntervalDays: 6,
    intensiveWindowDays: 120,
    throttleMs: 500,
    trueColorSize: 256,
    historicalBaselineDays: 1095,
  },
  carbon: {
    gwpCh4: 27, // IPCC AR6
    gwpN2o: 273,
    defaultN2oIncreaseFactor: 0.15,
  },
  phase: {
    thresholds: {
      kosong: 0.15,
      semai: 0.3,
      vegetatif: 0.5,
      generatif: 0.65,
    },
    ndwiDryThresholdLow: -0.35,
    ndwiDryThresholdHigh: -0.3,
  },
  database: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
} as const;
