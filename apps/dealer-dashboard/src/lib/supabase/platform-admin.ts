import { notFound } from 'next/navigation';
import { getDealerProfile } from './profile';

export async function requirePlatformAdmin() {
  const profile = await getDealerProfile();
  if (profile?.platformRole !== 'platform_admin') {
    notFound();
  }
  return profile;
}
