import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export function Login() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'sending') return;
    setStatus('sending');
    setError('');
    const { error } = await signInWithEmail(email);
    if (error) {
      setStatus('error');
      setError(error);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
            <Dumbbell className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Fitness Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">Connecte-toi pour retrouver tes séances sur tous tes appareils</p>
        </div>

        {status === 'sent' ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <h2 className="font-semibold text-gray-900">Vérifie tes emails</h2>
              <p className="text-sm text-gray-500 mt-1">
                On a envoyé un lien de connexion à <span className="font-medium text-gray-700">{email}</span>.
                Clique dessus depuis cet appareil pour te connecter.
              </p>
            </div>
            <button
              onClick={() => { setStatus('idle'); setEmail(''); }}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Adresse email</span>
              <div className="relative mt-1.5">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </label>

            {status === 'error' && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {status === 'sending' ? 'Envoi…' : 'Recevoir mon lien de connexion'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Pas de mot de passe : on t'envoie un lien magique par email.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
