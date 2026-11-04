export const HEALTH_PATH = '/health';

export type ServiceHealth = {
  status: 'ok';
  service: string;
  timestamp: string;
  database: 'configured' | 'missing';
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
};
