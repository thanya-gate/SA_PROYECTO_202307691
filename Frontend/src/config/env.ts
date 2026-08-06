interface EnvConfig {
  apiBaseUrl: string;
  allowedDomains: string[];
}

export const config: EnvConfig = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api',
  allowedDomains: ['@ing.usac.edu.gt', '@ingenieria.usac.edu.gt'],
};
