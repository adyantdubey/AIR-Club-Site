import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import { isDemo } from '../lib/db';
import { useTable } from '../lib/useData';
import { canEdit, isStaff, ROLE_LABEL } from '../lib/roles';
import { destroyLenis } from '../lib/lenis';
import Logo from '../components/ui/Logo';

export const NAV = [
  { to: '/admin', label: 'Dashboard', area: 'dashboard', icon: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 7h6V4h-6z', end: true },
  { to: '/admin/projects', label: 'Projects', area: 'projects', icon: 'M4 16h16M7 16v-4h10v4M8 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4M16 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4M12 12V7h4' },
  { to: '/admin/events', label: 'Events', area: 'events', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { to: '/admin/announcements', label: 'Announcements', area: 'announcements', icon: 'M4 10v4h3l6 4V6L7 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11' },
  { to: '/admin/ideas', label: 'Ideas', area: 'ideas', icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v1h6v-1c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3' },
  { to: '/admin/achievements', label: 'Achievements', area: 'achievements', icon: 'M8 4h8v6a4 4 0 0 1-8 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M12 14v4M9 20h6' },
  { to: '/admin/gallery', label: 'Gallery', area: 'gallery', icon: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4 3-3L20 16M15 9h.01' },
  { to: '/admin/team', label: 'Team', area: 'team', icon: 'M9 10a3 3 0 1 0 0-6a3 3 0 1 0 0 6M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5M16 11a2.5 2.5 0 1 0 0-5M17 15c2 .4 3.4 1.9 4 5' },
  { to: '/admin/content', label: 'Page content', area: 'content', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { to: '/admin/learn', label: 'Learn videos', area: 'learn', icon: 'M4 6h16v11H4zM10 9.5l5 2-5 2zM8 20h8' },
  { to: '/admin/settings', label: 'Settings', area: 'settings', icon: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19 12l2-1-1-3-2 .3-1.4-1.4.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L5.8 7.3 4 7l-1 3 2 1v2l-2 1 1 3 2-.3 1.4 1.4-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.4-1.4 2 .3 1-3-2-1z' },
];

/** Shell for every /admin page: login check, sidebar, top bar. */
export default function AdminLayout() {
  const { user, role, loading, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { rows: pendingIdeas } = useTable('ideas', { eq: { status: 'pending' }, order: null });

  // admin uses normal scrolling and the normal mouse cursor
  useEffect(() => {
    destroyLenis();
    document.body.classList.remove('has-cursor');
    document.body.style.cursor = '';
  }, []);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const page = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));
    document.title = `${page?.label || 'Admin'} · Admin · AIR Club`;
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="h-14 w-14 animate-pulse rounded-full border" style={{ borderColor: 'var(--blue)' }} />
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isStaff(role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="display text-2xl font-bold">No admin access</div>
        <p style={{ color: 'var(--muted)' }}>Your account has no role yet. Ask a super admin to give you one.</p>
        <button className="ctl-btn" onClick={signOut}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="admin-shell relative" style={{ zIndex: 2 }}>
      <div className="bg-grid" aria-hidden="true" style={{ opacity: 0.5 }} />

      {/* sidebar */}
      <aside className={`admin-side ${open ? 'open' : ''}`}>
        <Link to="/" className="flex items-center gap-3 px-5 py-5">
          <Logo size={30} />
          <span className="display text-sm font-bold leading-tight">
            AIR Club
            <span className="mono block text-[9px] font-normal tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
              CONTROL ROOM
            </span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((n) => {
            const locked = n.area !== 'dashboard' && !canEdit(role, n.area);
            return (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
                <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={n.icon} />
                </svg>
                <span className="flex-1">{n.label}</span>
                {n.area === 'ideas' && pendingIdeas.length > 0 && (
                  <span className="mono rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'var(--blue)', color: '#fff' }}>
                    {pendingIdeas.length}
                  </span>
                )}
                {locked && (
                  <svg className="h-3.5 w-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="view only">
                    <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />
                  </svg>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
          <div className="truncate text-sm font-medium">{user.full_name}</div>
          <div className="truncate text-xs" style={{ color: 'var(--muted)' }}>
            {user.email}
          </div>
          <div className="mono mt-1 text-[9px] tracking-[0.2em]" style={{ color: 'var(--blue-glow)' }}>
            {ROLE_LABEL[role].toUpperCase()}
          </div>
          <div className="mt-3 flex gap-2">
            <Link to="/" className="ctl-btn small flex-1 text-center">
              Site ↗
            </Link>
            <button className="ctl-btn small flex-1" onClick={signOut}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-[105] bg-black/60 min-[901px]:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* main */}
      <div className="relative min-w-0">
        <header className="sticky top-0 z-[90] flex items-center justify-between gap-3 border-b px-5 py-3 backdrop-blur md:px-8" style={{ borderColor: 'var(--line)', background: 'rgba(5,8,16,.75)' }}>
          <button className="ctl-btn small min-[901px]:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="mono hidden text-[10px] tracking-[0.25em] min-[901px]:block" style={{ color: 'var(--muted)' }}>
            ADMIN {location.pathname.replace('/admin', '').toUpperCase().replace(/\//g, ' / ') || '/ DASHBOARD'}
          </div>
          {isDemo && (
            <span className="badge" data-tone="warn" title="No Supabase keys in client/.env — changes are saved in this browser only">
              Demo mode · saved in this browser
            </span>
          )}
        </header>
        <main className="px-5 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
