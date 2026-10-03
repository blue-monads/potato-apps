import React, { useState } from 'react';
import { getUserProfileImageUrl, getAirtableAvatar } from '../lib/api';

export interface UserAvatarProps {
  userId: number | string;
  name?: string;
  className?: string;
  roundedClassName?: string;
  showPresence?: boolean;
  isOnline?: boolean;
  presenceClassName?: string;
  alt?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  name,
  className = 'w-7 h-7',
  roundedClassName = 'rounded-md',
  showPresence = false,
  isOnline = false,
  presenceClassName,
  alt
}) => {
  const [imageError, setImageError] = useState(false);
  const avatarUrl = getUserProfileImageUrl(userId, name);
  const fallback = getAirtableAvatar(Number(userId) || 0, name);

  return (
    <div className={`relative flex-shrink-0 inline-flex items-center justify-center ${className}`}>
      {!imageError ? (
        <img
          src={avatarUrl}
          alt={alt || name || 'User avatar'}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover ${roundedClassName} border border-slate-200/80 shadow-2xs bg-slate-100`}
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-bold text-[11px] ${roundedClassName} border ${fallback.bg} ${fallback.text} ${fallback.border} shadow-2xs select-none`}
        >
          {fallback.initial}
        </div>
      )}

      {showPresence && (
        <span
          className={
            presenceClassName ||
            `absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-white ${
              isOnline ? 'bg-emerald-500' : 'bg-slate-300'
            }`
          }
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default UserAvatar;
