// Avatars « initiale colorée » : couleur déterministe dérivée d'une graine
// (id de profil), pour un rendu stable et cohérent sans emoji.

const PALETTE = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-cyan-500',
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export function avatarInitial(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : '?';
}
