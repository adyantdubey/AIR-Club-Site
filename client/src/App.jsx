import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import Layout from './components/ui/Layout';
import { AuthProvider } from './lib/auth';
import { ContentProvider } from './lib/content';

// Each page is its own download chunk (G15) — Home stays fast.
const Home = lazy(() => import('./pages/Home'));
const RoboticsHub = lazy(() => import('./pages/RoboticsHub'));
const MachinePage = lazy(() => import('./pages/MachinePage'));
const AiHub = lazy(() => import('./pages/AiHub'));
const LabPage = lazy(() => import('./pages/LabPage'));
const About = lazy(() => import('./pages/About'));
const Projects = lazy(() => import('./pages/Projects'));
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Learn = lazy(() => import('./pages/Learn'));
const Team = lazy(() => import('./pages/Team'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Ideas = lazy(() => import('./pages/Ideas'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Admin area — separate layout (sidebar, no 3D, normal scrolling), only for logged-in staff
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const Dashboard = lazy(() => import('./admin/Dashboard'));
const AdminProjects = lazy(() => import('./admin/AdminProjects'));
const AdminEvents = lazy(() => import('./admin/AdminEvents'));
const AdminAchievements = lazy(() => import('./admin/AdminAchievements'));
const AdminIdeas = lazy(() => import('./admin/AdminIdeas'));
const AdminGallery = lazy(() => import('./admin/AdminGallery'));
const AdminTeam = lazy(() => import('./admin/AdminTeam'));
const AdminAnnouncements = lazy(() => import('./admin/AdminAnnouncements'));
const AdminSettings = lazy(() => import('./admin/AdminSettings'));
const AdminContent = lazy(() => import('./admin/AdminContent'));
const AdminLearn = lazy(() => import('./admin/AdminLearn'));

export default function App() {
  return (
    <AuthProvider>
      <ContentProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<S><Home /></S>} />
            <Route path="robotics" element={<S><RoboticsHub /></S>} />
            <Route path="robotics/:slug" element={<S><MachinePage /></S>} />
            <Route path="ai" element={<S><AiHub /></S>} />
            <Route path="ai/:slug" element={<S><LabPage /></S>} />
            <Route path="about" element={<S><About /></S>} />
            <Route path="projects" element={<S><Projects /></S>} />
            <Route path="projects/:slug" element={<S><ProjectDetail /></S>} />
            <Route path="events" element={<S><Events /></S>} />
            <Route path="events/:id" element={<S><EventDetail /></S>} />
            <Route path="learn" element={<S><Learn /></S>} />
            <Route path="team" element={<S><Team /></S>} />
            <Route path="gallery" element={<S><Gallery /></S>} />
            <Route path="ideas" element={<S><Ideas /></S>} />
            <Route path="announcements" element={<S><Announcements /></S>} />
            <Route path="contact" element={<S><Contact /></S>} />
            <Route path="login" element={<S><Login /></S>} />
            <Route path="*" element={<S><NotFound /></S>} />
          </Route>

          <Route path="admin" element={<S><AdminLayout /></S>}>
            <Route index element={<S><Dashboard /></S>} />
            <Route path="projects" element={<S><AdminProjects /></S>} />
            <Route path="events" element={<S><AdminEvents /></S>} />
            <Route path="announcements" element={<S><AdminAnnouncements /></S>} />
            <Route path="ideas" element={<S><AdminIdeas /></S>} />
            <Route path="achievements" element={<S><AdminAchievements /></S>} />
            <Route path="gallery" element={<S><AdminGallery /></S>} />
            <Route path="team" element={<S><AdminTeam /></S>} />
            <Route path="content" element={<S><AdminContent /></S>} />
            <Route path="learn" element={<S><AdminLearn /></S>} />
            <Route path="settings" element={<S><AdminSettings /></S>} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ContentProvider>
    </AuthProvider>
  );
}

const S = ({ children }) => <Suspense fallback={<PageFallback />}>{children}</Suspense>;

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <div className="h-16 w-16 animate-pulse rounded-full border" style={{ borderColor: 'var(--blue)' }} />
    </div>
  );
}
