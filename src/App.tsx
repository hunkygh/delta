import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import Home from './pages/Home';
import CalendarView from './pages/CalendarView';
import DocViewer from './pages/DocViewer';
import Settings from './pages/Settings';
import LaneWorkspaceView from './pages/LaneWorkspaceView';
import FocalsView from './pages/FocalsView';
import ListView from './pages/ListView';
import ShellRefactorView from './pages/ShellRefactorView';
import Login from './components/Auth/Login';
import Stockyard from './stockyard/Stockyard';
import { AuthProvider } from './context/AuthContext';

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/stockyard" element={<Stockyard />} />
        <Route path="/shell" element={<ShellRefactorView />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<CalendarView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/launchpad" element={<Home />} />
          <Route path="/dashboard" element={<Navigate to="/launchpad" replace />} />

          <Route path="/lanes" element={<LaneWorkspaceView />} />
          <Route path="/tasks" element={<LaneWorkspaceView />} />
          <Route path="/projects" element={<LaneWorkspaceView />} />

          <Route path="/focals" element={<FocalsView />} />
          <Route path="/focals/:focalId" element={<FocalsView />} />
          <Route path="/focals/list/:listId" element={<ListView />} />

          <Route path="/spaces" element={<FocalsView />} />
          <Route path="/spaces/:focalId" element={<FocalsView />} />
          <Route path="/spaces/list/:listId" element={<ListView />} />

          <Route path="/docs" element={<DocViewer />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}