import { Outlet, Link, useLocation } from 'react-router';
import { Home, Dumbbell, ListChecks, TrendingUp, Bot, Settings } from 'lucide-react';

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/workouts', icon: Dumbbell, label: 'Séances' },
    { path: '/exercises', icon: ListChecks, label: 'Exercices' },
    { path: '/progress', icon: TrendingUp, label: 'Progrès' },
    { path: '/ai', icon: Bot, label: 'Coach IA' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">💪 Fitness Tracker</h1>
          <Link
            to="/settings"
            className={`p-1.5 rounded-lg transition-colors ${
              location.pathname === '/settings'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Réglages"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="max-w-lg mx-auto px-2">
          <div className="flex justify-around">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center py-3 px-4 transition-colors ${
                  isActive(path) ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
