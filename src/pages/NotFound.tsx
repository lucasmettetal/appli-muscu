import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="text-center py-20 space-y-3">
      <p className="text-6xl font-bold text-gray-100">404</p>
      <p className="text-lg font-semibold text-gray-700">Page introuvable</p>
      <p className="text-sm text-gray-400">Cette page n'existe pas ou a été déplacée.</p>
      <Link
        to="/"
        className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Retour au tableau de bord
      </Link>
    </div>
  );
}
