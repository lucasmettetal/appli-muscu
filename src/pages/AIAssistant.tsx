import { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import {
  createAIService,
  ClaudeAIService,
  MockAIService,
  CLAUDE_KEY,
  type AIMessage,
} from '@/lib/ai-service';
import { buildSystemPrompt } from '@/lib/ai-context';
import { Bot, Send, Loader2, Sparkles, Key, X, Eye, EyeOff, Trash2, CheckCircle2 } from 'lucide-react';

// ─── Suggestions rapides ──────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'Analyse mes dernières séances',
  'Suis-je en progression ?',
  'Que travailler ce soir ?',
  'Conseils récupération',
];

// ─── Modal de configuration de la clé API ─────────────────────────────────────

function APIKeyModal({
  currentKey,
  onSave,
  onClose,
}: {
  currentKey: string | null;
  onSave: (key: string | null) => void;
  onClose: () => void;
}) {
  const [input, setInput]       = useState(currentKey ?? '');
  const [visible, setVisible]   = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null);
  const [testError, setTestError]   = useState('');

  const handleTest = async () => {
    if (!input.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const svc = new ClaudeAIService(input.trim());
      await svc.chat([{ role: 'user', content: 'Dis juste "OK".' }], 'Réponds uniquement "OK".');
      setTestResult('ok');
    } catch (e) {
      setTestResult('error');
      setTestError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setTesting(false);
    }
  };

  const isValidKey = (k: string) => k.startsWith('sk-ant-');

  const handleSave = () => {
    const key = input.trim() || null;
    if (key && !isValidKey(key)) {
      setTestResult('error');
      setTestError('Format invalide — la clé doit commencer par "sk-ant-".');
      return;
    }
    if (key) {
      localStorage.setItem(CLAUDE_KEY, key);
    } else {
      localStorage.removeItem(CLAUDE_KEY);
    }
    onSave(key);
    onClose();
  };

  const handleRemove = () => {
    localStorage.removeItem(CLAUDE_KEY);
    onSave(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-2xl p-6 space-y-5 max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Connecter Claude</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Entre ta clé API Anthropic pour utiliser Claude Haiku. Elle sera stockée uniquement dans ton navigateur et ne sera jamais partagée.
        </p>

        {/* Champ clé */}
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={input}
            onChange={e => { setInput(e.target.value); setTestResult(null); }}
            placeholder="sk-ant-api03-…"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-mono focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <button
            onClick={() => setVisible(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Résultat du test */}
        {testResult === 'ok' && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Connexion réussie ! Claude est prêt.
          </div>
        )}
        {testResult === 'error' && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <strong>Erreur :</strong> {testError}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={!input.trim() || testing}
            className="flex-1 text-sm border border-gray-200 rounded-xl py-2.5 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Tester la clé'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-medium transition-colors"
          >
            {input.trim() ? 'Enregistrer' : 'Passer en mode démo'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Le test de clé nécessite <span className="font-mono">pnpm dev</span> — pas disponible en preview.
        </p>

        {currentKey && (
          <button
            onClick={handleRemove}
            className="w-full text-sm text-red-400 hover:text-red-600 flex items-center justify-center gap-1.5 pt-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer la clé et revenir en mode démo
          </button>
        )}

        <p className="text-xs text-gray-400 text-center">
          Obtiens une clé sur{' '}
          <span className="font-mono">console.anthropic.com</span>
        </p>
      </div>
    </div>
  );
}

// ─── Bulle de message ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function AIAssistant() {
  const { workouts, exercises } = useWorkout();

  const [apiKey, setApiKey]       = useState<string | null>(() => localStorage.getItem(CLAUDE_KEY));
  const [showKeyModal, setShowKeyModal] = useState(false);

  const isRealClaude = !!apiKey;

  // Recréer le service quand la clé change
  const serviceRef = useRef(createAIService());
  useEffect(() => {
    serviceRef.current = apiKey ? new ClaudeAIService(apiKey) : new MockAIService();
  }, [apiKey]);

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: `Bonjour ! Je suis ton coach IA. 💪\n\nJe peux analyser tes performances, t'aider à planifier tes séances et répondre à tes questions sur l'entraînement.\n\nQue veux-tu savoir ?`,
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const systemPrompt   = buildSystemPrompt(workouts, exercises);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: AIMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const windowedMessages = nextMessages.slice(-10);
      const reply = await serviceRef.current.chat(windowedMessages, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Désolé, une erreur est survenue :\n${msg}\n\nVérifie ta clé API dans les paramètres.` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, systemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasHistory = workouts.length > 0;

  return (
    <>
      {showKeyModal && (
        <APIKeyModal
          currentKey={apiKey}
          onSave={setApiKey}
          onClose={() => setShowKeyModal(false)}
        />
      )}

      <div className="flex flex-col h-[calc(100vh-8rem)]">

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200 shrink-0">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">Coach IA</h2>
            <p className="text-xs text-gray-400 truncate">
              {hasHistory
                ? `${workouts.length} séance${workouts.length > 1 ? 's' : ''} analysée${workouts.length > 1 ? 's' : ''}`
                : 'Aucune séance enregistrée'}
            </p>
          </div>
          {/* Badge statut + bouton paramètres */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
              isRealClaude
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {isRealClaude
              ? <><Bot className="w-3 h-3" /> Claude</>
              : <><Sparkles className="w-3 h-3" /> Mode démo</>
            }
          </button>
        </div>

        {/* Zone de messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
          {messages.map((msg, i) => (
            <div key={i}>
              <MessageBubble message={msg} />
              {msg.role === 'assistant' && (
                <p className="text-[10px] text-gray-300 ml-9 mt-0.5">
                  {isRealClaude ? 'Claude Haiku' : 'Mode démo'}
                </p>
              )}
            </div>
          ))}
          {loading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions rapides */}
        {messages.length <= 1 && !loading && (
          <div className="pb-3 shrink-0">
            <p className="text-xs text-gray-400 mb-2">Suggestions :</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-gray-200 pt-3">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder:text-gray-300 disabled:opacity-50 leading-relaxed max-h-28 overflow-y-auto"
              style={{ height: 'auto' }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white flex items-center justify-center transition-colors shrink-0"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <p className="text-[10px] text-gray-300 text-center mt-2">
            {isRealClaude
              ? 'Propulsé par Claude Haiku · Clé stockée localement'
              : 'Mode démo · Appuie sur le badge pour connecter Claude'
            }
          </p>
        </div>
      </div>
    </>
  );
}
