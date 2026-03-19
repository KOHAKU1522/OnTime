import { Route, Routes } from 'react-router-dom';
import { ROUTES } from './const';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CalendarPage from "./pages/CalendarPage";
import SettingPage from "./pages/SettingPage";
import MacroPage from "./pages/MacroPage";

import './App.css';
import ProtectedRoute from './components/ProtectedRoute';

import Layout from "./components/Layout/Layout";
import { useDarkMode } from "./hooks/useDarkMode";

function App() {
  useDarkMode();
  return (
    <>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
          <Route path={ROUTES.SETTING} element={<SettingPage />} />
          <Route path={ROUTES.MACRO} element={<MacroPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
