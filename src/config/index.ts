import appConfigJson from './app.config.json';
import statusesJson from './statuses.json';
import onboardingJson from './onboarding.json';

export interface AppConfig {
  name: string;
  shortName: string;
  version: string;
  schemaVersion: number;
  tagline: string;
  description: string;
}

export interface StatusConfig {
  id: 'planned' | 'in_progress' | 'completed' | 'abandoned';
  label: string;
  description: string;
  color: string;
  isTerminal: boolean;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string;
  badge?: string;
  highlights?: string[];
  donate?: boolean;
}

export interface OnboardingConfig {
  version: number;
  steps: OnboardingStep[];
}

export const appConfig: AppConfig = appConfigJson;
export const statusConfigs: StatusConfig[] = statusesJson.statuses as StatusConfig[];
export const onboardingConfig: OnboardingConfig = onboardingJson;
