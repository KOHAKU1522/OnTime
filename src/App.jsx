import { Route, Routes } from 'react-router-dom';
import { ROUTES } from './const';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CalendarPage from "./pages/CalendarPage";
import SettingPage from "./pages/SettingPage";
import MacroPage from "./pages/MacroPage";
import CodeRefPage from "./pages/CodeRefPage";
import GuidePage from './pages/GuidePage';
import OtherAppsPage from "./pages/OtherAppsPage"

import './App.css';
import ProtectedRoute from './components/ProtectedRoute';

import Layout from "./components/Layout/Layout";
import { useDarkMode } from "./hooks/useDarkMode";
import { useState } from 'react';

function App() {

  useDarkMode();

  const [isGuest, setIsGuest] = useState(false);
  const [guestTasks, setGuestTasks] = useState([]);

  return (
    <>
      <Routes>
        <Route path={ROUTES.LOGIN}
          element={<LoginPage isGuest={isGuest} setIsGuest={setIsGuest} />}
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
    </>
  );
}

export default App;
