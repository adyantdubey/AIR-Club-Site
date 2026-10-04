/**
 * Sample data used in DEMO MODE (when no Supabase keys are set in client/.env).
 *
 * It is copied into the browser's storage the first time the site opens, so you can
 * add / edit / delete things in /admin and see them on the public pages straight away.
 * "Reset demo data" in Admin → Settings puts everything back to this file.
 *
 * Once Supabase is connected this file is not used — the real database is.
 */
import { projects as baseProjects } from './projects';
import { upcoming } from './events';
import { CLUB, FACULTY, TEAM, OLD_PROJECTS, OLD_EVENTS, VIDEOS, drive } from './oldSite';

const now = Date.now();
const daysAgo = (d) => new Date(now - d * 864e5).toISOString();
const daysAhead = (d) => new Date(now + d * 864e5).toISOString();

// ---------------- projects ----------------
const PROJECT_EXTRA = {
  'irc-rover': { category: 'Robotics', status: 'in_progress', progress: 68, team_size: 14, lead: 'Rover Lead', start_date: '2026-01-10', end_date: '2027-05-30' },
  'vital-vision': { category: 'Computer Vision', status: 'testing', progress: 85, team_size: 5, lead: 'Member Six', start_date: '2025-08-01', end_date: '2026-11-30' },
  'snn-chip': { category: 'Hardware', status: 'in_progress', progress: 42, team_size: 4, lead: 'Member Five', start_date: '2026-03-01', end_date: '2027-03-01' },
  'line-bot': { category: 'Embedded', status: 'completed', progress: 100, team_size: 6, lead: 'Member Three', start_date: '2025-08-15', end_date: '2025-10-20' },
  drone: { category: 'Aerial', status: 'in_progress', progress: 55, team_size: 7, lead: 'Member Two', start_date: '2026-02-01', end_date: '2026-12-15' },
};

const projects = [
  ...baseProjects.map((p, i) => ({
    id: p.id,
    slug: p.id,
    title: p.title,
    summary: p.blurb,
    description: p.blurb,
    tech: p.tech,
    featured: i < 3,
    repo_url: 'https://github.com',
    demo_url: '',
    created_at: daysAgo(200 - i * 20),
    updated_at: daysAgo(i * 3),
    ...PROJECT_EXTRA[p.id],
  })),
  {
    id: 'hexabot-gait',
    slug: 'hexabot-gait',
    title: 'Hexabot Gait Engine',
    summary: 'Tripod and ripple gaits for our six-legged walker, tuned in simulation first.',
    description: 'A gait engine that switches between tripod, wave and ripple walking depending on terrain.',
    tech: ['C++', 'Inverse kinematics', 'Servo bus'],
    category: 'Robotics',
    status: 'planning',
    progress: 15,
    team_size: 3,
    lead: 'Member Nine',
    start_date: '2026-09-01',
    end_date: '2027-02-28',
    featured: false,
    repo_url: '',
    demo_url: '',
    created_at: daysAgo(25),
    updated_at: daysAgo(4),
  },
  {
    id: 'cube-solver',
    slug: 'cube-solver',
    title: "Rubik's Cube Solver",
    summary: 'Camera reads the scramble, two-phase solver plans it, steppers turn it.',
    description: 'Vision + Kociemba two-phase algorithm + six stepper motors. Target: under 3 seconds.',
    tech: ['Python', 'OpenCV', 'Stepper drivers'],
    category: 'Robotics',
    status: 'on_hold',
    progress: 30,
    team_size: 4,
    lead: 'Member Eleven',
    start_date: '2026-04-01',
    end_date: '',
    featured: false,
    repo_url: '',
    demo_url: '',
    created_at: daysAgo(150),
    updated_at: daysAgo(40),
  },
  // ---- real projects from the previous website, shown under "Earlier projects" ----
  ...OLD_PROJECTS.map((p, i) => ({
    id: p.slug,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    description: p.summary,
    body: p.body,
    image_url: drive(p.image),
    image2_url: drive(p.image2),
    tech: p.tech,
    category: p.category,
    status: p.status,
    progress: p.progress,
    team_size: null,
    lead: '',
    start_date: '',
    end_date: '',
    featured: false,
    archived: true,
    repo_url: '',
    demo_url: '',
    created_at: daysAgo(700 + i),
    updated_at: daysAgo(700 + i),
  })),
];

// ---------------- events ----------------
const events = [
  ...upcoming.map((e, i) => ({
    id: `ev-${i + 1}`,
    title: e.title,
    kind: e.kind,
    starts_at: e.date,
    ends_at: '',
    venue: e.where,
    description: `${e.title} — open to all branches and years.`,
    registration_open: true,
    capacity: [40, 120, 60, 30][i] || 50,
    created_at: daysAgo(30),
  })),
  // ---- real past events from the previous website ----
  ...OLD_EVENTS.map((e) => ({
    id: e.id,
    title: e.title,
    kind: e.kind,
    starts_at: e.starts_at,
    ends_at: e.ends_at || '',
    venue: e.venue,
    description: e.summary,
    body: e.body,
    image_url: drive(e.image),
    image2_url: drive(e.image2),
    link: e.link || '',
    registration_open: false,
    capacity: e.capacity,
    created_at: e.starts_at,
  })),
];

const event_registrations = [
  { id: 'reg-1', event_id: 'ev-2', name: 'Ananya R', email: 'ananya@student.nitandhra.ac.in', created_at: daysAgo(2) },
  { id: 'reg-2', event_id: 'ev-2', name: 'Karthik M', email: 'karthik@student.nitandhra.ac.in', created_at: daysAgo(1) },
  { id: 'reg-3', event_id: 'ev-3', name: 'Sai Teja', email: 'saiteja@student.nitandhra.ac.in', created_at: daysAgo(1) },
];

// ---------------- announcements ----------------
const announcements = [
  { id: 'an-1', title: 'Recruitment 2026 is open', body: 'First and second years from every branch can apply for Rover, Drone, AI Lab and Web teams. No experience needed — a short task and a chat.', category: 'recruitment', priority: 'urgent', pinned: true, link: '/contact', publish_at: daysAgo(3), expires_at: daysAhead(12), created_at: daysAgo(3) },
  { id: 'an-2', title: 'IRC 2027 team selection — submit your task by Friday', body: 'Upload your navigation or arm-control task to the shared drive. Late entries cannot be considered.', category: 'deadline', priority: 'high', pinned: false, link: '', publish_at: daysAgo(1), expires_at: daysAhead(3), created_at: daysAgo(1) },
  { id: 'an-3', title: 'Intro to ROS 2 — seats filling up', body: 'Bring a laptop with Ubuntu 22.04 (or a VM). We will set up a workspace together and drive a simulated rover.', category: 'event', priority: 'normal', pinned: false, link: '/events', publish_at: daysAgo(5), expires_at: '', created_at: daysAgo(5) },
  { id: 'an-4', title: 'Lab closed on Saturday for maintenance', body: 'The 3D printers and power benches are being serviced. The drone cage stays open.', category: 'notice', priority: 'low', pinned: false, link: '', publish_at: daysAgo(6), expires_at: '', created_at: daysAgo(6) },
  { id: 'an-5', title: 'Idea Box winners get lab time', body: 'The three most-upvoted ideas this month get a mentor and a budget for parts. Submit yours on the Idea Box page.', category: 'notice', priority: 'normal', pinned: false, link: '/ideas', publish_at: daysAgo(8), expires_at: '', created_at: daysAgo(8) },
];

// ---------------- ideas ----------------
const ideas = [
  { id: 'id-1', tracking_code: 'AIR-7Q2K', title: 'Campus delivery robot for the library', description: 'A small rover that carries returned books from the drop box to the shelves. Could reuse the IRC navigation stack.', category: 'Robotics', author_name: 'Priya S', author_email: '', is_anonymous: false, status: 'approved', review_note: 'Great reuse of the rover stack. Mentor assigned.', upvotes: 24, created_at: daysAgo(12), reviewed_at: daysAgo(9) },
  { id: 'id-2', tracking_code: 'AIR-M4X8', title: 'Sign-language to text glove', description: 'Flex sensors + IMU on a glove, a tiny model on an ESP32 that prints letters on a phone.', category: 'AI / ML', author_name: '', author_email: '', is_anonymous: true, status: 'implemented', review_note: 'Built as a freshers project — demo at Tech Fest.', upvotes: 31, created_at: daysAgo(80), reviewed_at: daysAgo(70) },
  { id: 'id-3', tracking_code: 'AIR-P9D3', title: 'Hostel energy dashboard', description: 'Smart plugs + a dashboard showing which floor uses the most power, with weekly leaderboards.', category: 'IoT', author_name: 'Rahul K', author_email: '', is_anonymous: false, status: 'approved', review_note: '', upvotes: 17, created_at: daysAgo(20), reviewed_at: daysAgo(15) },
  { id: 'id-4', tracking_code: 'AIR-B2N6', title: 'Weekly paper-reading circle', description: 'One ML or robotics paper each week, 30 minutes, one presenter.', category: 'Club activity', author_name: '', author_email: '', is_anonymous: true, status: 'under_review', review_note: '', upvotes: 9, created_at: daysAgo(4), reviewed_at: '' },
  { id: 'id-5', tracking_code: 'AIR-H5T1', title: 'Drone that maps the campus trees', description: 'Count and tag every tree with a drone + YOLO and share the map with the green club.', category: 'Aerial', author_name: 'Meera J', author_email: '', is_anonymous: false, status: 'pending', review_note: '', upvotes: 3, created_at: daysAgo(1), reviewed_at: '' },
  { id: 'id-6', tracking_code: 'AIR-C8L4', title: 'Buy a laser cutter', description: 'Would speed up chassis work a lot.', category: 'Lab & equipment', author_name: '', author_email: '', is_anonymous: true, status: 'rejected', review_note: 'Out of this year\'s budget — we will share the workshop cutter instead.', upvotes: 12, created_at: daysAgo(30), reviewed_at: daysAgo(26) },
];

// ---------------- achievements ----------------
const achievements = [
  { id: 'ac-1', year: '2026', title: 'Robo Soccer — Winners', event_name: 'Inter-NIT Tech Fest', kind: 'WIN', description: '', certificate_url: '', created_at: daysAgo(90) },
  { id: 'ac-2', year: '2025', title: 'Line-follower — 2nd place', event_name: 'State Robotics League', kind: 'PODIUM', description: '', certificate_url: '', created_at: daysAgo(200) },
  { id: 'ac-3', year: '2025', title: 'Vision Hackathon — Best Hardware', event_name: 'ASTA × NIT AP', kind: 'SPECIAL', description: '', certificate_url: '', created_at: daysAgo(300) },
  { id: 'ac-4', year: '2024', title: 'Drone Day — Autonomy award', event_name: 'Campus Aero Meet', kind: 'SPECIAL', description: '', certificate_url: '', created_at: daysAgo(500) },
  { id: 'ac-5', year: '2024', title: 'FPGA Design Challenge — Finalists', event_name: 'National VLSI Contest', kind: 'FINAL', description: '', certificate_url: '', created_at: daysAgo(520) },
  { id: 'ac-6', year: '2023', title: 'Freshers Bootcamp — 120 signups', event_name: 'NIT AP', kind: 'MILESTONE', description: '', certificate_url: '', created_at: daysAgo(800) },
];

// ---------------- gallery (empty url = drawn placeholder tile) ----------------
const media = [
  ['Rover on the test track', 'builds'],
  ['Robo Soccer final', 'competitions'],
  ['Freshers bootcamp', 'workshops'],
  ['Soldering night', 'lab'],
  ['Drone Day line-up', 'events'],
  ['Arm picks its first cube', 'builds'],
  ['PCB design sprint', 'workshops'],
  ['Tech Fest stall', 'events'],
  ['Shaastra podium', 'competitions'],
  ['3D printer farm', 'lab'],
  ['Hexabot first steps', 'builds'],
  ['ROS 2 study jam', 'workshops'],
].map(([title, category], i) => ({
  id: `md-${i + 1}`,
  title,
  category,
  url: '',
  kind: 'image',
  caption: '',
  taken_on: daysAgo(10 + i * 14).slice(0, 10),
  created_at: daysAgo(10 + i * 14),
}));

// ---------------- team ----------------
// Real team from the previous website (placeholder until the new list arrives) + the faculty coordinator
const team_members = [
  ...TEAM.map((m, i) => ({ id: `tm-${i}`, name: m.name, role: m.role, group: m.group, department: '', year: '', bio: '', photo_url: m.photo_url, email: '', linkedin: m.linkedin, is_lead: m.is_lead, sort_order: m.sort_order })),
  ...FACULTY.map((f, i) => ({ id: `tm-f${i}`, name: f.name, role: f.role, group: 'faculty', department: f.department, year: '', bio: f.bio, photo_url: f.photo_url, email: f.email, linkedin: '', is_lead: false, sort_order: 100 + i })),
];

// ---------------- messages ----------------
const contact_messages = [
  { id: 'cm-1', name: 'Vikram P', email: 'vikram@student.nitandhra.ac.in', branch: 'MECH, 1st year', team: 'Rover', message: 'I have done some CAD in SolidWorks — would love to help with the chassis.', status: 'new', created_at: daysAgo(1) },
];

// Learn page videos (from the previous website)
const resources = VIDEOS.map(([kind, title, yt], i) => ({ id: `rs-${i + 1}`, title, url: `https://www.youtube.com/watch?v=${yt}`, kind, description: '', sort_order: i, created_at: daysAgo(500 - i) }));

// ---------------- settings (one row) ----------------
const site_settings = [
  {
    id: 1,
    club_name: CLUB.club_name,
    tagline: CLUB.tagline,
    email: CLUB.email,
    phone: CLUB.phone,
    address: CLUB.address,
    office_hours: 'Mon–Fri · 5:00–8:00 PM\nSat · 10:00 AM–1:00 PM',
    instagram: CLUB.instagram,
    github: CLUB.github,
    linkedin: CLUB.linkedin,
    youtube: CLUB.youtube,
    mission: CLUB.mission,
    vision: 'A campus lab that ships autonomous robots and useful AI, and a place India’s next robotics founders start from.',
    recruitment_open: true,
  },
];

const audit_log = [
  { id: 'al-1', actor_email: 'superadmin@demo.air', action: 'update', table_name: 'projects', record_id: 'irc-rover', summary: 'IRC 2027 Rover', created_at: daysAgo(0.2) },
  { id: 'al-2', actor_email: 'events@demo.air', action: 'insert', table_name: 'announcements', record_id: 'an-2', summary: 'IRC 2027 team selection — submit your task by Friday', created_at: daysAgo(1) },
  { id: 'al-3', actor_email: 'ideas@demo.air', action: 'update', table_name: 'ideas', record_id: 'id-3', summary: 'Hostel energy dashboard → approved', created_at: daysAgo(2) },
];

export const SEED = {
  projects,
  events,
  event_registrations,
  announcements,
  ideas,
  idea_votes: [],
  site_content: [], // filled when an admin edits page text
  achievements,
  media,
  team_members,
  contact_messages,
  resources,
  site_settings,
  audit_log,
};

/** Demo log-ins (demo mode only). Password for all: demo1234 */
export const DEMO_USERS = [
  { id: 'u-super', email: 'superadmin@demo.air', full_name: 'Demo Super Admin', role: 'super_admin' },
  { id: 'u-club', email: 'clubadmin@demo.air', full_name: 'Demo Club Admin', role: 'club_admin' },
  { id: 'u-proj', email: 'projects@demo.air', full_name: 'Demo Project Coordinator', role: 'project_coordinator' },
  { id: 'u-event', email: 'events@demo.air', full_name: 'Demo Event Coordinator', role: 'event_coordinator' },
  { id: 'u-idea', email: 'ideas@demo.air', full_name: 'Demo Idea Reviewer', role: 'idea_reviewer' },
  { id: 'u-view', email: 'viewer@demo.air', full_name: 'Demo Viewer', role: 'viewer' },
];
export const DEMO_PASSWORD = 'demo1234';
