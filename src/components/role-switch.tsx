import { getRoles, ROLE_INFO } from '@/lib/roles';
import { RoleTabs } from './role-tabs';

/** Top-bar tabs to move between ተማሪ / መምህር / አመራር (only the roles this person has). */
export async function RoleSwitch() {
  const roles = await getRoles();
  if (roles.length < 2) return null;
  return <RoleTabs tabs={roles.map((r) => ({ href: ROLE_INFO[r].href, label: ROLE_INFO[r].label }))} />;
}
