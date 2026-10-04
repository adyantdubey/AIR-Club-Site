/**
 * Who is allowed to do what in the admin area.
 *
 * Six levels. Everyone who can log in can LOOK at every admin page;
 * only the roles listed against an area can CHANGE things there.
 * The database (Supabase row-level security) enforces the same rules,
 * so hiding a button here is a convenience, not the real lock.
 */

export const ROLES = ['super_admin', 'club_admin', 'project_coordinator', 'event_coordinator', 'idea_reviewer', 'viewer'];

export const ROLE_LABEL = {
  super_admin: 'Super admin',
  club_admin: 'Club admin',
  project_coordinator: 'Project coordinator',
  event_coordinator: 'Event coordinator',
  idea_reviewer: 'Idea reviewer',
  viewer: 'Viewer (read only)',
};

const ADMINS = ['super_admin', 'club_admin'];

// area -> roles that may create / edit / delete there
const EDIT = {
  projects: [...ADMINS, 'project_coordinator'],
  achievements: [...ADMINS, 'project_coordinator'],
  events: [...ADMINS, 'event_coordinator'],
  announcements: [...ADMINS, 'event_coordinator'],
  gallery: [...ADMINS, 'event_coordinator'],
  ideas: [...ADMINS, 'idea_reviewer'],
  team: ADMINS,
  settings: ADMINS,
  content: ADMINS, // page text: about, FAQ, sponsors, history, home headline…
  learn: ADMINS, // Learn page videos
  access: ['super_admin'], // changing other people's roles
};

export const canEdit = (role, area) => !!role && (EDIT[area] || []).includes(role);
export const isStaff = (role) => ROLES.includes(role);

/** Where to land right after logging in. */
export function homeFor(role) {
  switch (role) {
    case 'project_coordinator':
      return '/admin/projects';
    case 'event_coordinator':
      return '/admin/events';
    case 'idea_reviewer':
      return '/admin/ideas';
    default:
      return '/admin';
  }
}
