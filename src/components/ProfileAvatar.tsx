import { avatarColor, avatarInitial } from '../lib/avatar';

interface ProfileAvatarProps {
  name: string;
  seed: string; // graine stable (id du profil) pour la couleur
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Avatar « initiale colorée » déterministe (remplace les emojis de profil). */
export function ProfileAvatar({ name, seed, size = 'md', className = '' }: ProfileAvatarProps) {
  const sizeCls =
    size === 'sm' ? 'w-6 h-6 text-[11px]' : size === 'lg' ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold text-white ${sizeCls} ${avatarColor(seed)} ${className}`}
    >
      {avatarInitial(name)}
    </span>
  );
}
