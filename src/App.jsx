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
import { lazy, useState } from 'react';

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

  const [isGuest, setIsGuest] = useState(false);
  const [guestTasks, setGuestTasks] = useState([]);

  return (
    <DialogProvider>
      <Routes>
        <Route path={ROUTES.LOGIN}
          element={<LoginPage setIsGuest={setIsGuest} />}
        />

        <Route
          element={
            <ProtectedRoute isGuest={isGuest}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path={ROUTES.HOME}
            element={<HomePage isGuest={isGuest} guestTasks={guestTasks} setGuestTasks={setGuestTasks} />}
          />
          <Route
            path={ROUTES.CALENDAR}
            element={<CalendarPage isGuest={isGuest} guestTasks={guestTasks} />}
          />
          <Route path={ROUTES.SETTING} element={<SettingPage />} />
          <Route path={ROUTES.MACRO} element={<MacroPage />} />
          <Route path={ROUTES.CODE_REF} element={<CodeRefPage />} />
          <Route path={ROUTES.GUIDE} element={<GuidePage />} />
          <Route path={ROUTES.OTHER_APPS} element={<OtherAppsPage />} />
        </Route>
      </Routes>
    </DialogProvider>
  );
}

export default App;
