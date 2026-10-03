import React, { useState, useEffect } from 'react';
import { usersApi, type User } from '../lib/api';
import UserAvatar from './UserAvatar';
import { X, Search, MessageSquare, Loader2 } from 'lucide-react';

interface StartDirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (userId: number) => Promise<void>;
}

const StartDirectChatModal: React.FC<StartDirectChatModalProps> = ({
  isOpen,
  onClose,
  onStartChat
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingUserId, setSubmittingUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const users = await usersApi.list();
        setAllUsers(users.filter(u => !u.is_self));
      } catch (err: any) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectUser = async (userId: number) => {
    setSubmittingUserId(userId);
    setError(null);
    try {
      await onStartChat(userId);
      setSearchQuery('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start direct chat.');
    } finally {
      setSubmittingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs select-none">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/90 flex justify-between items-center bg-white">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-[#eef2fe] text-[#2d7ff9] border border-blue-200/60 flex items-center justify-center font-bold text-xs shadow-2xs">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">New Direct Message</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200/90 rounded-md text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type a name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* User List */}
          <div className="max-h-72 overflow-y-auto space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-[#2d7ff9]" />
                Loading workspace teammates...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                {searchQuery ? 'No matching people found' : 'No other members in space'}
              </div>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user.id)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200/80 cursor-pointer transition-all group"
                >
                  <div className="flex items-center space-x-2.5 truncate min-w-0">
                    <UserAvatar
                      userId={user.id}
                      name={user.name}
                      className="w-7 h-7"
                      showPresence
                      isOnline={user.is_online}
                    />

                    <div className="flex flex-col truncate min-w-0">
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 truncate transition-colors">
                          {user.name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">
                          {user.email || (user.is_online ? 'Active now' : 'Offline')}
                        </span>
                      </div>
                    </div>

                    <button
                      disabled={submittingUserId === user.id}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 group-hover:bg-[#2d7ff9] group-hover:text-white transition-all flex items-center gap-1 shadow-2xs"
                    >
                      {submittingUserId === user.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Chat'
                      )}
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartDirectChatModal;