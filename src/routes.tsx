import { createBrowserRouter } from 'react-router';
import { Dashboard } from './pages/Dashboard';
import { Workouts } from './pages/Workouts';
import { Exercises } from './pages/Exercises';
import { ExerciseDetail } from './pages/ExerciseDetail';
import { Progress } from './pages/Progress';
import { AIAssistant } from './pages/AIAssistant';
import { Settings } from './pages/Settings';
import { Layout } from './components/Layout';
import { WorkoutSession } from './pages/WorkoutSession';
import { NotFound } from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'workouts', Component: Workouts },
      { path: 'workout/:id', Component: WorkoutSession },
      { path: 'exercises', Component: Exercises },
      { path: 'exercise/:id', Component: ExerciseDetail },
      { path: 'progress', Component: Progress },
      { path: 'ai', Component: AIAssistant },
      { path: 'settings', Component: Settings },
      { path: '*', Component: NotFound },
    ],
  },
]);
