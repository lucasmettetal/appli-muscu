import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';

// Le Layout (coquille) et le Dashboard (page d'accueil) sont chargés
// immédiatement pour un premier affichage rapide. Les autres pages sont
// découpées en chunks séparés et chargées à la demande — cela sort notamment
// recharts (graphiques) du bundle initial.
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'workouts', lazy: async () => ({ Component: (await import('./pages/Workouts')).Workouts }) },
      { path: 'workout/:id', lazy: async () => ({ Component: (await import('./pages/WorkoutSession')).WorkoutSession }) },
      { path: 'exercises', lazy: async () => ({ Component: (await import('./pages/Exercises')).Exercises }) },
      { path: 'exercise/:id', lazy: async () => ({ Component: (await import('./pages/ExerciseDetail')).ExerciseDetail }) },
      { path: 'progress', lazy: async () => ({ Component: (await import('./pages/Progress')).Progress }) },
      { path: 'ai', lazy: async () => ({ Component: (await import('./pages/AIAssistant')).AIAssistant }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('./pages/Settings')).Settings }) },
      { path: '*', lazy: async () => ({ Component: (await import('./pages/NotFound')).NotFound }) },
    ],
  },
]);
