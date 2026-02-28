import { invoke } from '@tauri-apps/api/core';
import type { OsintProfile, CompanyEmail, OsintExclusion } from '../types';

export async function harvestSender(
  email: string,
  rawHeaders?: string,
  claudeApiKey?: string,
  dockerContainer?: string,
): Promise<OsintProfile> {
  return invoke('osint_harvest_sender', {
    email,
    rawHeaders: rawHeaders || null,
    claudeApiKey: claudeApiKey || null,
    dockerContainer: dockerContainer || null,
  });
}

export async function getProfile(email: string): Promise<OsintProfile | null> {
  return invoke('osint_get_profile', { email });
}

export async function harvestCompany(
  domain: string,
  claudeApiKey?: string,
  dockerContainer?: string,
): Promise<CompanyEmail[]> {
  return invoke('osint_harvest_company', {
    domain,
    claudeApiKey: claudeApiKey || null,
    dockerContainer: dockerContainer || null,
  });
}

export async function getCompanyEmails(domain: string): Promise<CompanyEmail[]> {
  return invoke('osint_get_company_emails', { domain });
}

export async function checkExcluded(email: string, rawHeaders?: string): Promise<boolean> {
  return invoke('osint_check_excluded', {
    email,
    rawHeaders: rawHeaders || null,
  });
}

export async function listExclusions(): Promise<OsintExclusion[]> {
  return invoke('osint_list_exclusions');
}

export async function addExclusion(
  pattern: string,
  patternType: string,
  description?: string,
): Promise<number> {
  return invoke('osint_add_exclusion', {
    pattern,
    patternType,
    description: description || null,
  });
}

export async function removeExclusion(id: number): Promise<void> {
  return invoke('osint_remove_exclusion', { id });
}

export async function checkDocker(dockerContainer?: string): Promise<boolean> {
  return invoke('osint_check_docker', {
    dockerContainer: dockerContainer || null,
  });
}
