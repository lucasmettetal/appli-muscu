import { RouterProvider } from 'react-router';
import { Loader2 } from 'lucide-react';
import { router } from './routes';
import { WorkoutProvider } from './context/WorkoutContext';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';

// Décide quoi afficher selon l'état d'authentification :
//  - synchro non configurée → mode local (profils navigateur)
//  - configurée + session absente → écran de connexion
//  - configurée + connecté → mode cloud (données du compte)
// Le WorkoutProvider est remonté (key) au changement de compte OU de profil
// local, pour recharger les bonnes données.
function AppGate() {
  const { configured, loading, session } = useAuth();
  const { activeProfileId } = useProfile();

  if (configured && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (configured && !session) {
    return <Login />;
  }

  const storageKey = configured && session ? session.user.id : activeProfileId;

  return (
    <WorkoutProvider key={storageKey}>
      <RouterProvider router={router} />
    </WorkoutProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <AppGate />
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;
