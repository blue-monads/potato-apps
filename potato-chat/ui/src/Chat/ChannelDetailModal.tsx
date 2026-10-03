import React, { useEffect, useState } from 'react';
import { 
  channelsApi, 
  usersApi, 
  type Channel, 
  type User, 
  type ChannelMember 
} from '../lib/api';
import UserAvatar from './UserAvatar';
import { 
  X, 
  Hash, 
  Lock, 
  UserPlus, 
  Calendar, 
  Shield, 
  Trash2, 
  LogOut, 
  Check, 
  Loader2 
} from 'lucide-react';

interface ChannelDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: number | null;
  currentUserId?: number;
  onChannelDeleted?: (channelId: number) => void;
  onChannelLeft?: (channelId: number) => void;
}

const ChannelDetailModal: React.FC<ChannelDetailModalProps> = ({
  isOpen,
  onClose,
  channelId,
  currentUserId,
  onChannelDeleted,
  onChannelLeft
}) => {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [creator, setCreator] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'members' | 'invite'>('about');
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !channelId) return;

    const loadData = async () => {
      setLoading(true);
      setActionError(null);
      try {
        const [channels, memberList, usersList] = await Promise.all([
          channelsApi.list(),
          channelsApi.getMembers(channelId),
          usersApi.list()
        ]);

        const foundChannel = channels.find(c => Number(c.id) === Number(channelId));
        if (foundChannel) {
          setChannel(foundChannel);
          const creatorUser = usersList.find(u => Number(u.id) === Number(foundChannel.created_by_user_id));
          setCreator(creatorUser || null);
        }

        setMembers(memberList);
        setAllUsers(usersList);
      } catch (err: any) {
        console.error('Failed to load channel details:', err);
        setActionError(err.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [channelId, isOpen]);

  if (!isOpen) return null;

  const isCurrentUserAdmin = members.some(
    m => Number(m.user_id) === Number(currentUserId) && m.is_admin
  ) || channel?.created_by_user_id === currentUserId;

  const isCreator = channel?.created_by_user_id === currentUserId;

  // Filter users who are not yet members of the channel
  const memberIdSet = new Set(members.map(m => Number(m.user_id)));
  const nonMemberUsers = allUsers.filter(u => !memberIdSet.has(Number(u.id)));

  const handleInviteUser = async (userId: number) => {
    if (!channelId) return;
    setInvitingUserId(userId);
    setActionError(null);
    try {
      await channelsApi.invite(channelId, userId);
      const updatedMembers = await channelsApi.getMembers(channelId);
      setMembers(updatedMembers);
    } catch (err: any) {
      setActionError(err.message || 'Failed to invite user');
    } finally {
      setInvitingUserId(null);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!channelId || !window.confirm('Remove this member from channel?')) return;
    try {
      await channelsApi.removeMember(channelId, userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member');
    }
  };

  const handleLeaveChannel = async () => {
    if (!channelId || !window.confirm('Are you sure you want to leave this channel?')) return;
    try {
      await channelsApi.leave(channelId);
      onChannelLeft?.(channelId);
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to leave channel');
    }
  };

  const handleDeleteChannel = async () => {
    if (!channelId || !window.confirm('Delete this channel permanently? This cannot be undone.')) return;
    try {
      await channelsApi.delete(channelId);
      onChannelDeleted?.(channelId);
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete channel');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs select-none">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/90 flex justify-between items-center bg-white">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-[#eef2fe] text-[#2d7ff9] border border-blue-200/60 flex items-center justify-center font-bold text-xs shadow-2xs">
              {channel?.visibility === 'private' ? (
                <Lock className="w-3.5 h-3.5 text-purple-600" />
              ) : (
                <Hash className="w-3.5 h-3.5 text-[#2d7ff9]" />
              )}
            </div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight truncate max-w-sm">
              {channel ? channel.name : 'Channel Info'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-5 bg-white">
          <button
            onClick={() => setActiveTab('about')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'about'
                ? 'border-[#2d7ff9] text-[#2d7ff9]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'border-[#2d7ff9] text-[#2d7ff9]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Members</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
              {members.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'invite'
                ? 'border-[#2d7ff9] text-[#2d7ff9]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3 h-3" />
            <span>Add People</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {actionError && (
            <div className="mb-4 p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#2d7ff9]" />
              <span>Loading details...</span>
            </div>
          ) : !channel ? (
            <div className="text-center py-12 text-slate-400 text-xs">Channel not found</div>
          ) : activeTab === 'about' ? (
            <div className="space-y-4">
              {/* Description */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  {channel.description || 'No description provided.'}
                </p>
              </div>

              {/* Channel Meta Details */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Created By
                  </span>
                  <div className="flex items-center space-x-2">
                    <UserAvatar
                      userId={channel.created_by_user_id}
                      name={creator?.name}
                      className="w-5.5 h-5.5"
                    />
                    <span className="text-xs font-medium text-slate-800 truncate">
                      {creator ? creator.name : `User #${channel.created_by_user_id}`}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Created Date
                  </span>
                  <div className="flex items-center space-x-1.5 text-slate-800 text-xs font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(channel.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Visibility</span>
                  <span className="font-medium text-slate-800 capitalize">
                    {channel.visibility} Channel
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Messages</span>
                  <span className="font-medium text-slate-800">
                    {channel.max_messages || 0}
                  </span>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {!isCreator && channel.visibility !== 'direct' && (
                  <button
                    onClick={handleLeaveChannel}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Channel
                  </button>
                )}

                {isCurrentUserAdmin && channel.visibility !== 'direct' && (
                  <button
                    onClick={handleDeleteChannel}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Channel
                  </button>
                )}
              </div>
            </div>
          ) : activeTab === 'members' ? (
            <div className="space-y-1.5">
              {members.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No members found</div>
              ) : (
                members.map(member => {
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <UserAvatar
                          userId={member.user_id}
                          name={member.name}
                          className="w-7 h-7"
                          showPresence
                          isOnline={member.is_online}
                        />

                        <div className="flex flex-col truncate min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {member.name}
                            </span>
                            {member.is_self && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                                you
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 truncate">
                            {member.email || (member.is_online ? 'Active now' : 'Offline')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {member.is_admin ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Admin
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Member</span>
                        )}

                        {/* Admin remove button */}
                        {isCurrentUserAdmin && !member.is_self && channel.visibility !== 'direct' && (
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove member"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Invite Users Tab
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500 mb-2">
                Select a teammate from this workspace to invite them to #{channel.name}.
              </p>

              {nonMemberUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-slate-200/80">
                  <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <span className="text-xs font-medium">All workspace members are already here!</span>
                </div>
              ) : (
                nonMemberUsers.map(user => {
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white shadow-2xs"
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <UserAvatar
                          userId={user.id}
                          name={user.name}
                          className="w-7 h-7"
                        />
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {user.name}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate">
                            {user.email || 'Workspace member'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleInviteUser(user.id)}
                        disabled={invitingUserId === user.id}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#2d7ff9] text-white hover:bg-[#1b6fe5] shadow-2xs disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                      >
                        {invitingUserId === user.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        <span>Invite</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelDetailModal;
