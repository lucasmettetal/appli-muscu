import { RouterProvider } from 'react-router';
import { router } from './routes';
import { WorkoutProvider } from './context/WorkoutContext';
import { ProfileProvider, useProfile } from './context/ProfileContext';

// Le WorkoutProvider est remonté (key) à chaque changement de profil : tout son
// état se réinitialise alors depuis les données isolées du profil sélectionné.
function AppInner() {
  const { activeProfileId } = useProfile();
  return (
    <WorkoutProvider key={activeProfileId}>
      <RouterProvider router={router} />
    </WorkoutProvider>
  );
}

function App() {
  return (
    <ProfileProvider>
      <AppInner />
    </ProfileProvider>
  );
}

export default App;
