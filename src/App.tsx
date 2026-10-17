import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { RouterProvider, useRouter } from '@/context/RouterContext';
import { CreationProvider } from '@/context/CreationContext';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { AppShell } from '@/components/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { AIChat } from '@/pages/AIChat';
import { ImageGenerator } from '@/pages/ImageGenerator';
import { ImageEditor } from '@/pages/ImageEditor';
import { VideoGenerator } from '@/pages/VideoGenerator';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { LibraryPage } from '@/pages/LibraryPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PricingPage } from '@/pages/PricingPage';
import { TermsPage } from '@/pages/TermsPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { HelpPage } from '@/pages/HelpPage';
import { ContactPage } from '@/pages/ContactPage';
import { LoadingState } from '@/components/ui/Feedback';

function Routes() {
  const { path } = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Loading ORVEXA..." />
      </div>
    );
  }

  const publicRoutes = ['/', '/pricing', '/terms', '/privacy', '/help', '/contact'];
  const isPublicRoute = publicRoutes.includes(path) || path.startsWith('/auth');

  if (path === '/auth') return <AuthPage />;

  if (isPublicRoute && !user) {
    switch (path) {
      case '/pricing': return <PricingPage />;
      case '/terms': return <TermsPage />;
      case '/privacy': return <PrivacyPage />;
      case '/help': return <HelpPage />;
      case '/contact': return <ContactPage />;
      default: return <LandingPage />;
    }
  }

  if (!user) return <AuthPage />;

  const workspaceRoutes: Record<string, React.FC> = {
    '/dashboard': Dashboard,
    '/chat': AIChat,
    '/image': ImageGenerator,
    '/edit': ImageEditor,
    '/video': VideoGenerator,
    '/templates': TemplatesPage,
    '/explore': ExplorePage,
    '/library': LibraryPage,
    '/history': HistoryPage,
    '/projects': ProjectsPage,
    '/settings': SettingsPage,
    '/pricing': PricingPage,
    '/terms': TermsPage,
    '/privacy': PrivacyPage,
    '/help': HelpPage,
    '/contact': ContactPage,
  };

  const Page = workspaceRoutes[path];
  if (Page) {
    return (
      <AppShell>
        <Page />
      </AppShell>
    );
  }

  return <LandingPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <CreationProvider>
            <RouterProvider>
              <Routes />
            </RouterProvider>
          </CreationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
