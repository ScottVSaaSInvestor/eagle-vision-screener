import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NewScreeningPage } from '@/pages/NewScreeningPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { ReportPage } from '@/pages/ReportPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
        />
        <Route
          path="/new"
          element={<ProtectedRoute><NewScreeningPage /></ProtectedRoute>}
        />
        <Route
          path="/progress/:jobId"
          element={<ProtectedRoute><ProgressPage /></ProtectedRoute>}
        />
        <Route
          path="/report/:jobId"
          element={<ProtectedRoute><ReportPage /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
