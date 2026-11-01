import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Header from './components/Header.jsx';
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

function AppContent() {
  const [route, setRoute] = useState(() => ({ page: window.location.hash.includes('type=recovery') ? 'reset-password' : 'landing', params: {} }));
  const [draftProposal, setDraftProposal] = useState(null);
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const protectedPages = [
        'dashboard',
        'profile',
        'propose',
        'similar',
        'proposals',
        'proposal-detail',
        'my-projects',
        'project-detail',
        'edit-project',
        'admin',
        'final-verification',
        'verified-history',
      ];
      if (protectedPages.includes(route.page)) {
        navigate('landing');
      }
    }
  }, [user, loading, route.page]);

  const navigate = (page, params = {}) => {
    setRoute({ page, params });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const renderPage = () => {
    const protectedPages = [
      'dashboard',
      'profile',
      'propose',
      'similar',
      'proposals',
      'proposal-detail',
      'my-projects',
      'project-detail',
      'edit-project',
      'admin',
      'final-verification',
      'verified-history',
    ];

    if (!loading && !user && protectedPages.includes(route.page)) {
      return <LandingPage navigate={navigate} />;
    }

    switch (route.page) {
      case 'landing':
        return <LandingPage navigate={navigate} />;
      case 'login':
        return <LoginPage navigate={navigate} />;
      case 'reset-password':
        return <ResetPasswordPage navigate={navigate} />;
      case 'register':
        return <RegisterPage navigate={navigate} />;
      case 'dashboard':
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
      <Header navigate={navigate} currentPage={route.page} />
      <main className="flex-1 px-4 py-6 md:px-8 max-w-7xl mx-auto w-full">
        {renderPage()}
      </main>
      <Footer />
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







