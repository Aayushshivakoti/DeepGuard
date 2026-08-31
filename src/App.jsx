import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/common/Toast';

// Core Public Pages (immediate initial load)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Lazy-Loaded Dashboard Views & Heavy Components (code-split for minimal initial bundle)
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));
const EmailVerificationPage = lazy(() => import('./pages/EmailVerificationPage'));
const PublicReportPage = lazy(() => import('./pages/PublicReportPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const Dropzone = lazy(() => import('./components/workspace/Dropzone'));
const CompareSlider = lazy(() => import('./components/CompareSlider'));
const ScanProgress = lazy(() => import('./components/workspace/ScanProgress'));

function PageSkeletonLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans p-6" style={{ background: 'var(--bg-main, #0b0f19)', color: 'var(--text-main, #e2e8f0)' }}>
      <div className="w-10 h-10 rounded-full border-3 border-cyan-500 border-t-transparent animate-spin mb-4" />
      <div className="w-48 h-3.5 bg-slate-800/80 rounded animate-pulse" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <PageSkeletonLoader />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, role, isLoading } = useAuth();
  if (isLoading) {
    return <PageSkeletonLoader />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (role?.toUpperCase() !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<PageSkeletonLoader />}>
              <Routes>
                {/* Public Core Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/password-reset" element={<PasswordResetPage />} />
                <Route path="/verify-email" element={<EmailVerificationPage />} />
                <Route path="/verify/:report_hash" element={<PublicReportPage />} />

                {/* Protected User Routes */}
                <Route path="/dashboard/*" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
                <Route path="/upload" element={<ProtectedRoute><Dropzone /></ProtectedRoute>} />
                <Route path="/compare" element={<ProtectedRoute><CompareSlider /></ProtectedRoute>} />
                <Route path="/scan-progress" element={<ProtectedRoute><ScanProgress /></ProtectedRoute>} />

                {/* Protected Admin Routes */}
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <ToastContainer />
        </ToastProvider>
      </AppProvider>
    </AuthProvider>
  );
}
