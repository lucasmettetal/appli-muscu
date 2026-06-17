import { RouterProvider } from 'react-router';
import { router } from './routes';
import { WorkoutProvider } from './context/WorkoutContext';

function App() {
  return (
    <WorkoutProvider>
      <RouterProvider router={router} />
    </WorkoutProvider>
  );
}

export default App;
