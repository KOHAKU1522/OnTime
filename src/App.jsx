import { Route, Routes } from 'react-router-dom';
import { ROUTES } from './const';

// 初期表示に必要なページ（ログイン・ホーム）は通常読み込み
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

import './App.css';
import ProtectedRoute from './components/ProtectedRoute';

import Layout from "./components/Layout/Layout";
import DialogProvider from "./components/Dialog/DialogProvider";
import { useDarkMode } from "./hooks/useDarkMode";
import { lazy, Suspense, useState } from 'react';
import PageLoader from './components/PageLoader/PageLoader';

// それ以外のページは開いたときに読み込む（読み込み中表示は Layout の Suspense）
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SettingPage = lazy(() => import("./pages/SettingPage"));
const MacroPage = lazy(() => import("./pages/MacroPage"));
const GuidePage = lazy(() => import("./pages/GuidePage"));
const OtherAppsPage = lazy(() => import("./pages/OtherAppsPage"));
// codes.js（大きな静的データ）を含む
const CodeRefPage = lazy(() => import("./pages/CodeRefPage"));

function App() {

  useDarkMode();
  const [showFirstGuide, setShowFirstGuide] = useState(() => {
    try { return localStorage.getItem('ontime.guide.seen') !== 'true'; }
    catch { return true; }
  });

  const finishFirstGuide = () => {
    try { localStorage.setItem('ontime.guide.seen', 'true'); } catch { /* Continue for this session. */ }
    setShowFirstGuide(false);
  };

  return (
    <DialogProvider>
      {showFirstGuide ? (
        <Suspense fallback={<PageLoader />}>
          <GuidePage onFinish={finishFirstGuide} />
        </Suspense>
      ) : (
      <Routes>
        <Route path={ROUTES.LOGIN}
          element={<LoginPage />}
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path={ROUTES.HOME}
            element={<HomePage />}
          />
          <Route
            path={ROUTES.CALENDAR}
            element={<CalendarPage />}
          />
          <Route path={ROUTES.SETTING} element={<SettingPage />} />
          <Route path={ROUTES.MACRO} element={<MacroPage />} />
          <Route path={ROUTES.CODE_REF} element={<CodeRefPage />} />
          <Route path={ROUTES.GUIDE} element={<GuidePage />} />
          <Route path={ROUTES.OTHER_APPS} element={<OtherAppsPage />} />
        </Route>
      </Routes>
      )}
    </DialogProvider>
  );
}

export default App;
