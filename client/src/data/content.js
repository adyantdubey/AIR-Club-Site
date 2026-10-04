/**
 * Page text that an admin can change in Admin → Page content.
 *
 * These are the DEFAULTS. Once an admin saves a section, the saved version (kept in the
 * `site_content` table) is used instead. "Reset to default" in the admin page brings these back.
 */
import { ABOUT, VALUES, FAQ, TECHKRIYA } from './oldSite';

export const DEFAULT_CONTENT = {
  // ---- Home: top of the page ----
  hero: {
    sub: 'AI & Robotics Club · NIT Andhra Pradesh',
    line1: 'BUILDING THE',
    line2: 'MACHINES THAT',
    accent: 'EXPLORE',
    text: 'Students at NIT Andhra Pradesh designing autonomous rovers, vision systems and neuromorphic hardware — from first solder joint to competition field.',
    stats: [
      { v: 40, suffix: '+', label: 'members' },
      { v: 12, suffix: '', label: 'projects' },
      { v: 2027, suffix: '', label: 'IRC target' },
    ],
  },
  // ---- Home: the four counters ----
  counters: [
    { v: 8, suffix: '', label: 'machines built' },
    { v: 8, suffix: '', label: 'models in the lab' },
    { v: 40, suffix: '+', label: 'members' },
    { v: 6, suffix: '', label: 'competitions' },
  ],
  // ---- About ----
  about: { lead: ABOUT.lead, more: ABOUT.more, community: ABOUT.community, signoff: ABOUT.signoff },
  values: [
    ...VALUES.map(([title, text]) => ({ title, text })),
    { title: 'Open bench', text: 'Every branch, every year. Nobody needs prior experience to start.' },
    { title: 'Teach forward', text: 'Seniors mentor juniors; every build ends with a write-up others can learn from.' },
  ],
  history: [
    { year: '2019', title: 'Founded', text: 'A handful of ECE students and one soldering iron in a borrowed lab.' },
    { year: '2021', title: 'First autonomous bot', text: 'Line-follower that placed at the state-level tech fest.' },
    { year: '2024', title: 'Vision & FPGA tracks', text: 'Computer-vision and neuromorphic-hardware teams formed.' },
    { year: '2027', title: 'International Rover Challenge', text: 'Full six-wheel rover with GPS-denied autonomy heading to IRC.' },
  ],
  // The lab tour has five fixed spots (each has its own 3D model) — names and text can change.
  lab: [
    { id: 'bench', name: 'Electronics bench', text: 'Soldering, scopes and the PCB reflow plate. Where every board is born.' },
    { id: 'printer', name: '3D print corner', text: 'Two FDM printers running most nights — brackets, gears, rover parts.' },
    { id: 'track', name: 'Test track', text: 'A 4 × 3 m arena with rocks and a slope for rover and hexabot trials.' },
    { id: 'rack', name: 'Compute rack', text: 'A GPU box for training and a Jetson farm for on-robot testing.' },
    { id: 'cage', name: 'Drone cage', text: 'Netted flight space for the quad and the butterfly.' },
  ],
  week: [
    { day: 'MON', title: 'Build night', text: 'Rover chassis + arm servos' },
    { day: 'TUE', title: 'AI study jam', text: 'One paper, one whiteboard' },
    { day: 'WED', title: 'Flight slot', text: 'Drone cage, 6–8 pm' },
    { day: 'THU', title: 'PCB clinic', text: 'Bring your board, leave with a working one' },
    { day: 'FRI', title: 'Demo Friday', text: 'Show what moved this week' },
    { day: 'SAT', title: 'Field day', text: 'Test track + campus mapping' },
    { day: 'SUN', title: 'Off', text: 'Sleep. Or solder.' },
  ],
  sponsors: ['NIT Andhra Pradesh', 'ASTA Health Tech', 'goBILDA', 'Robu.in', 'IEEE Student Branch', 'Dept. of ECE', 'Institution Innovation Council', 'Xilinx University Program'].map((name) => ({ name })),
  // ---- FAQ (Home + Contact) ----
  faq: FAQ.map(([q, a]) => ({ q, a })),
  // ---- Techkriya competitions (Techkriya '23 event page) ----
  techkriya: TECHKRIYA.map(([name, text]) => ({ name, text })),
};

export const CONTENT_KEYS = Object.keys(DEFAULT_CONTENT);
