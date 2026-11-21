import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Footer from './components/Footer.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import SubmitProposalPage from './pages/SubmitProposalPage.jsx';
import SimilarCheckPage from './pages/SimilarCheckPage.jsx';
import MyProposalsPage from './pages/MyProposalsPage.jsx';
import FinalVerificationPage from './pages/FinalVerificationPage.jsx';
import VerifiedHistoryPage from './pages/VerifiedHistoryPage.jsx';
import ProposalDetailPage from './pages/ProposalDetailPage.jsx';
import MyProjectsPage from './pages/MyProjectsPage.jsx';
import SearchProjectsPage from './pages/SearchProjectsPage.jsx';
import EditProjectPage from './pages/EditProjectPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import FaqPage from './pages/FaqPage.jsx';

const dashboardForRole = {
  student: 'student-dashboard',
  faculty: 'faculty-dashboard',
  admin: 'admin-dashboard',
};

const pageRoles = {
  dashboard: ['student', 'faculty', 'admin'],
  'student-dashboard': ['student'],
  'faculty-dashboard': ['faculty'],
  'admin-dashboard': ['admin'],
  profile: ['student', 'faculty', 'admin'],
  propose: ['student'],
  similar: ['student'],
  'my-projects': ['student'],
  'edit-project': ['student', 'faculty', 'admin'],
  proposals: ['faculty'],
  'proposal-detail': ['faculty'],
  'final-verification': ['faculty'],
  'verified-history': ['faculty'],
  admin: ['admin'],
};

function initialRoute() {
  const path = window.location.hash.slice(1).split('?')[0].replace(/^\/+/, '');
  return { page: path || 'landing', params: {} };
}

function AppContent() {
  const [route, setRoute] = useState(initialRoute);
  const [draftProposal, setDraftProposal] = useState(null);
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user?.status === 'Pending' && (user.role !== 'faculty' || route.page !== 'pending-approval')) {
      navigate(user.role === 'faculty' ? 'pending-approval' : 'landing');
      return;
    }

    if (route.page === 'pending-approval') {
      if (!user) {
        navigate('login');
        return;
      }
      if (user.status === 'Active') {
        navigate(dashboardForRole[user.role] || 'landing');
        return;
      }
    }

    if (route.page === 'dashboard' && user) {
      navigate(dashboardForRole[user.role] || 'landing');
      return;
    }

    if (pageRoles[route.page]) {
      if (!user) {
        navigate('login', {
          role: Object.entries(dashboardForRole).find(([, page]) => page === route.page)?.[0],
        });
        return;
      }

      if (!pageRoles[route.page].includes(user.role)) {
        navigate(dashboardForRole[user.role] || 'landing');
      }
    }
  }, [user, loading, route.page]);

  const navigate = (page, params = {}) => {
    setRoute({ page, params });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const renderPage = () => {
    if (loading && pageRoles[route.page]) {
      return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">Loading your secure workspace…</div>;
    }
    if (!loading && pageRoles[route.page] && !user) {
      return <LoginPage navigate={navigate} intendedRole={route.params.role} />;
    }
    if (!loading && user && pageRoles[route.page] && !pageRoles[route.page].includes(user.role)) {
      return <DashboardPage navigate={navigate} />;
    }

    switch (route.page) {
      case 'landing':
        return <LandingPage navigate={navigate} />;
      case 'login':
        return <LoginPage navigate={navigate} intendedRole={route.params.role} />;
      case 'reset-password':
        return <ResetPasswordPage navigate={navigate} />;
      case 'register':
        return <RegisterPage navigate={navigate} />;
      case 'pending-approval':
        return (
          <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-violet-700">Faculty account</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Waiting for administrator approval</h1>
            <p className="mt-3 text-slate-600">
              Your email is verified, but faculty tools remain disabled until a ProjectVault administrator approves your account.
            </p>
            <p className="mt-3 text-sm text-slate-500">Signed in as {user?.email}</p>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('landing');
              }}
              className="mt-6 rounded-lg bg-vio px-4 py-3 font-semibold text-white"
            >
              Sign out
            </button>
          </section>
        );
      case 'dashboard':
        return <DashboardPage navigate={navigate} />;
      case 'student-dashboard':
      case 'faculty-dashboard':
      case 'admin-dashboard':
        return <DashboardPage navigate={navigate} />;
      case 'profile':
        return <ProfilePage navigate={navigate} />;
      case 'search-projects':
        return <SearchProjectsPage navigate={navigate} />;
      case 'project-detail':
        return <ProjectDetailPage id={route.params.id} navigate={navigate} />;
      case 'propose':
        return <SubmitProposalPage setDraftProposal={setDraftProposal} navigate={navigate} editId={route.params.id} />;
      case 'similar':
        return <SimilarCheckPage draftProposal={draftProposal} navigate={navigate} />;
      case 'proposals':
        return <MyProposalsPage navigate={navigate} />;
      case 'proposal-detail':
        return <ProposalDetailPage id={route.params.id} navigate={navigate} />;
      case 'my-projects':
        return <MyProjectsPage navigate={navigate} />;
      case 'edit-project':
        return <EditProjectPage id={route.params.id} navigate={navigate} />;
      case 'admin':
        return <AdminPage navigate={navigate} />;
      case 'faq':
        return <FaqPage navigate={navigate} />;
      case 'final-verification':
        return <FinalVerificationPage navigate={navigate} />;
      case 'verified-history':
        return <VerifiedHistoryPage navigate={navigate} />;
      default:
        return <LandingPage navigate={navigate} />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800">
      <Header navigate={navigate} />
      <div className={`mx-auto grid w-full max-w-7xl flex-1 items-start gap-6 px-4 py-6 md:px-8 ${user ? 'lg:grid-cols-[250px_minmax(0,1fr)]' : ''}`}>
        {user && <Sidebar navigate={navigate} currentPage={route.page} />}
        <main className="min-w-0">
          <div key={route.page} className="page-enter">
            {renderPage()}
          </div>
        </main>
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
