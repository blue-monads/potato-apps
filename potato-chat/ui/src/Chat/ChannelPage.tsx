import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { 
  channelsApi, 
  usersApi, 
  type Channel, 
  type User, 
  type ChannelMember
} from '../lib/api';
import UserAvatar from './UserAvatar';
import { 
  ArrowLeft, 
  Hash, 
  Lock, 
  Users, 
  Calendar, 
  MessageSquare, 
  Shield, 
  Loader2 
} from 'lucide-react';

const ChannelPage = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [creator, setCreator] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!channelId) return;
      setLoading(true);
      try {
        const cId = Number(channelId);
        const [channels, memberList, allUsers] = await Promise.all([
          channelsApi.list(),
          channelsApi.getMembers(cId),
          usersApi.list(),
        ]);
        const foundChannel = channels.find(c => Number(c.id) === cId);
        if (foundChannel) {
          setChannel(foundChannel);
          const creatorUser = allUsers.find(u => Number(u.id) === Number(foundChannel.created_by_user_id));
          setCreator(creatorUser || null);
        }
        setMembers(memberList);
      } catch (error) {
        console.error('Failed to load channel data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [channelId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-[#2d7ff9]" />
          <span>Loading channel information...</span>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-xs border border-slate-200 text-center">
        <h2 className="text-base font-semibold text-slate-800 mb-2">Channel Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">The channel you are looking for does not exist or has been removed.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-3.5 py-1.5 bg-[#2d7ff9] text-white rounded-md text-xs font-semibold hover:bg-[#1b6fe5] transition-colors shadow-2xs"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8 select-none">
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Chat
        </button>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
          {/* Header Banner */}
          <div className="p-5 border-b border-slate-100 bg-[#eef2fe]/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-white shadow-2xs border border-blue-200/60 flex items-center justify-center text-[#2d7ff9] font-bold text-base">
                {channel.visibility === 'private' ? <Lock className="w-5 h-5 text-purple-600" /> : <Hash className="w-5 h-5 text-[#2d7ff9]" />}
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  {channel.name}
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                    {channel.visibility}
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {channel.description || 'No description provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Metadata Cards */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 border-b border-slate-100">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Created By</span>
              <div className="flex items-center space-x-2">
                <UserAvatar
                  userId={channel.created_by_user_id}
                  name={creator ? creator.name : `User #${channel.created_by_user_id}`}
                  className="w-5 h-5"
                />
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {creator ? creator.name : `User #${channel.created_by_user_id}`}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Created Date</span>
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{new Date(channel.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Messages</span>
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>{channel.max_messages || 0} messages</span>
              </div>
            </div>
          </div>

          {/* Member List */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#2d7ff9]" /> Channel Members ({members.length})
              </h2>
            </div>

            {members.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No members in this channel.</p>
            ) : (
              <div className="space-y-1.5">
                {members.map(member => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-2.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <UserAvatar
                        userId={member.user_id}
                        name={member.name}
                        className="w-7 h-7"
                        showPresence
                        isOnline={member.is_online}
                      />
                      <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-slate-800">{member.name}</span>
                            {member.is_self && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded border border-slate-200/80 font-medium">
                                you
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {member.email || (member.is_online ? 'Online' : 'Offline')}
                          </span>
                        </div>
                      </div>

                      {member.is_admin ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Admin
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Member</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelPage;
