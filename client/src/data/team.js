// Team shown before the database answers (and in demo mode via seed.js).
// The real list lives in src/data/oldSite.js for now; edit people in Admin → Team.
// group: 'core' (office bearers) | 'executive' | 'software' | 'hardware' | 'faculty'
import { TEAM } from './oldSite';

const toCard = (m) => ({ name: m.name, role: m.role, group: m.group, photo: m.photo_url, linkedin: m.linkedin });

export const leads = TEAM.filter((m) => m.is_lead).map(toCard);
export const members = TEAM.filter((m) => !m.is_lead).map(toCard);

export const filters = [
  { key: 'all', label: 'All' },
  { key: 'core', label: 'Office bearers' },
  { key: 'executive', label: 'Executive members' },
];
