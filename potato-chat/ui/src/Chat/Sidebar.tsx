import React, { useState } from 'react';
import { type Channel, type User, isInsideIframe } from '../lib/api';
import UserAvatar from './UserAvatar';
import { 
  Hash, 
  Lock, 
  Plus, 
  Search, 
  X, 
  MessageSquare,
  PanelLeftClose
} from 'lucide-react';

interface SidebarProps {
  channels: Channel[];
  users: User[];
  activeChannel: Channel | null;
  currentUserId?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannelClick: () => void;
  onStartDirectChatClick: () => void;
  onStartDirectChat: (userId: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  channels,
  users,
  activeChannel,
  currentUserId,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
  onSelectChannel,
  onCreateChannelClick,
  onStartDirectChatClick,
  onStartDirectChat
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const inIframe = isInsideIframe();

  const publicAndPrivateChannels = channels.filter(c => c.visibility !== 'direct');

  const filteredChannels = publicAndPrivateChannels.filter(c =>
    c.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredUsers = users
    .filter(u => !u.is_self)
    .filter(u => u.name.toLowerCase().includes(filterQuery.toLowerCase()));

  const currentUser = users.find(u => u.is_self) || (currentUserId ? users.find(u => u.id === currentUserId) : null);

  const handleUserClick = (user: User) => {
    if (user.associated_channel) {
      const channelId = Number(user.associated_channel);
      const channel = channels.find(c => Number(c.id) === channelId);
      if (channel) {
        onSelectChannel(channel);
        onCloseMobile?.();
        return;
      }
    }
    onStartDirectChat(user.id);
    onCloseMobile?.();
  };

  const handleChannelClick = (channel: Channel) => {
    onSelectChannel(channel);
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 bg-[#f8fafc] text-slate-800 flex-shrink-0 border-r border-slate-200/90 shadow-xl md:shadow-none transition-all duration-200 ease-in-out select-none ${
          isOpenMobile ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${
          isCollapsed
            ? 'md:w-0 md:min-w-0 md:border-r-0 md:overflow-hidden md:opacity-0 pointer-events-none md:pointer-events-none'
            : 'md:w-64 md:min-w-[16rem] md:opacity-100'
        }`}
      >
        <div className="w-64 flex flex-col h-full">
          {/* Airtable-like Workspace Header */}
          <div className="h-13 px-3.5 border-b border-slate-200/90 flex items-center justify-between flex-shrink-0 bg-white">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-2xs flex-shrink-0 font-bold text-base">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate">
                <span className="font-semibold text-sm text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                  Potato Chat
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-0.5">
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="hidden md:flex p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}

              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 md:hidden transition-colors"
                  title="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

        {/* Quick Search Bar */}
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Find a channel or person..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-white text-xs text-slate-800 placeholder-slate-400 rounded-md pl-8 pr-7 py-1.5 border border-slate-200/90 shadow-2xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-5">
          {/* Channels Section */}
          <div>
            <div className="px-2 py-1 flex items-center justify-between text-slate-400 group">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Channels
              </span>
              <button
                onClick={onCreateChannelClick}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors"
                title="Create Channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <ul className="space-y-0.5 mt-0.5">
              {filteredChannels.length === 0 ? (
                <li className="px-2.5 py-1.5 text-xs text-slate-400 italic">No channels found</li>
              ) : (
                filteredChannels.map(channel => {
                  const isActive =
                    activeChannel?.id === channel.id &&
                    activeChannel?.visibility !== 'direct';
                  const hasUnread = (channel.unread_count || 0) > 0;

                  return (
                    <li
                      key={channel.id}
                      onClick={() => handleChannelClick(channel)}
                      className={`group relative px-2.5 py-1.5 rounded-md cursor-pointer flex items-center justify-between text-xs transition-all duration-100 ${
                        isActive
                          ? 'bg-[#eef2fe] text-[#2d7ff9] font-semibold border border-blue-200/60 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate min-w-0">
                        {channel.visibility === 'private' ? (
                          <Lock className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#2d7ff9]' : 'text-slate-400 group-hover:text-slate-500'}`} />
                        ) : (
                          <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#2d7ff9]' : 'text-slate-400 group-hover:text-slate-500'}`} />
                        )}
                        <span className={`truncate ${hasUnread && !isActive ? 'font-bold text-slate-900' : ''}`}>
                          {channel.name}
                        </span>
                      </div>

                      {hasUnread && !isActive && (
                        <span className="ml-1.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-[#2d7ff9] text-white flex-shrink-0 shadow-2xs">
                          {channel.unread_count}
                        </span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Direct Messages Section */}
          <div>
            <div className="px-2 py-1 flex items-center justify-between text-slate-400 group">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Direct Messages
              </span>
              <button
                onClick={onStartDirectChatClick}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors"
                title="New Direct Message"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <ul className="space-y-0.5 mt-0.5">
              {filteredUsers.length === 0 ? (
                <li className="px-2.5 py-1.5 text-xs text-slate-400 italic">No people found</li>
              ) : (
                filteredUsers.map(user => {
                  const isDmActive =
                    activeChannel?.visibility === 'direct' &&
                    user.associated_channel &&
                    Number(user.associated_channel) === Number(activeChannel?.id);

                  return (
                    <li
                      key={user.id}
                      onClick={() => handleUserClick(user)}
                      className={`group relative px-2.5 py-1.5 rounded-md cursor-pointer flex items-center justify-between text-xs transition-all duration-100 ${
                        isDmActive
                          ? 'bg-[#eef2fe] text-[#2d7ff9] font-semibold border border-blue-200/60 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate min-w-0">
                        {/* Potatoverse Profile Image Avatar */}
                        <UserAvatar
                          userId={user.id}
                          name={user.name}
                          className="w-5.5 h-5.5"
                          showPresence
                          isOnline={user.is_online}
                        />

                        <span className="truncate">{user.name}</span>
                      </div>

                      {user.is_online && !isDmActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Online" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>

        {/* User Profile Footer Card */}
        {!inIframe && (
          <div className="p-2.5 border-t border-slate-200/90 bg-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <UserAvatar
                  userId={currentUser?.id || 0}
                  name={currentUser?.name || 'You'}
                  className="w-7.5 h-7.5"
                  showPresence
                  isOnline
                />

                <div className="flex flex-col truncate min-w-0">
                  <span className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1">
                    {currentUser?.name || 'My Account'}
                    <span className="text-[10px] text-slate-400 font-normal">(you)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>
              </div>

              <button
                onClick={onStartDirectChatClick}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="New Direct Message"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
