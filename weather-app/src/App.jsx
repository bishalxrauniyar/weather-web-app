import { Component, Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Leva } from 'leva';
import LoadingScreen from './components/ui/LoadingScreen';
import { useGeolocation } from './hooks/useWeather';

const WeatherScene = lazy(() => import('./components/3d/WeatherScene'));
const WeatherDashboard = lazy(() => import('./components/WeatherDashboard'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

class SceneBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg, #0a0a14, #05050a)' }}
        >
          <div className="text-center px-8">
            <div className="text-4xl mb-4">🌐</div>
            <h1 className="text-white text-lg font-semibold mb-2">The scene crashed</h1>
            <p className="text-white/50 text-sm mb-6">Your device's graphics driver may have hiccuped.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-full bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { refetch } = useGeolocation();

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <>
      <LoadingScreen />
      <div className="relative w-full h-full overflow-hidden bg-black">
        <Suspense fallback={null}>
          <SceneBoundary>
            <WeatherScene />
          </SceneBoundary>
          <WeatherDashboard />
        </Suspense>
      </div>
      <Leva collapsed hidden />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;