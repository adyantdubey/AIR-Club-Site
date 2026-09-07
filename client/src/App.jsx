import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import Layout from './components/ui/Layout';

// Each page is its own download chunk (G15) — Home stays fast.
const Home = lazy(() => import('./pages/Home'));
const RoboticsHub = lazy(() => import('./pages/RoboticsHub'));
const MachinePage = lazy(() => import('./pages/MachinePage'));
const AiHub = lazy(() => import('./pages/AiHub'));
const LabPage = lazy(() => import('./pages/LabPage'));
const About = lazy(() => import('./pages/About'));
const Events = lazy(() => import('./pages/Events'));
const Team = lazy(() => import('./pages/Team'));
const Contact = lazy(() => import('./pages/Contact'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <Home />
              </Suspense>
            }
          />
          <Route path="robotics" element={<S><RoboticsHub /></S>} />
          <Route path="robotics/:slug" element={<S><MachinePage /></S>} />
          <Route path="ai" element={<S><AiHub /></S>} />
          <Route path="ai/:slug" element={<S><LabPage /></S>} />
          <Route path="about" element={<S><About /></S>} />
          <Route path="events" element={<S><Events /></S>} />
          <Route path="team" element={<S><Team /></S>} />
          <Route path="contact" element={<S><Contact /></S>} />
          <Route path="*" element={<S><NotFound /></S>} />
        </Route>
      </Routes>
    </BrowserRouter>
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
