import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  coreApi, 
  channelsApi, 
  usersApi, 
  messagesApi, 
  type Channel, 
  type User, 
  type Message, 
  getWSURL 
} from '../lib/api';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UserAvatar from './UserAvatar';
import CreateChannelModal from './CreateChannelModal';
import StartDirectChatModal from './StartDirectChatModal';
import ChannelDetailModal from './ChannelDetailModal';
import { 
  Menu, 
  Info, 
  Hash, 
  Search, 
  WifiOff, 
  X,
  Lock,
  PanelLeftOpen
} from 'lucide-react';

const ChatView = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  
  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDirectChatModalOpen, setIsDirectChatModalOpen] = useState(false);
  const [isChannelDetailOpen, setIsChannelDetailOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('potato_chat_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('potato_chat_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);
  
  // Replying
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  // Search within channel messages
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time status & Typing
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [typingUsers, setTypingUsers] = useState<{ [userId: number]: { name: string; timeout: NodeJS.Timeout } }>({});

  const wsRef = useRef<WebSocket | null>(null);
  const activeChannelRef = useRef<Channel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  // Connect / Reconnect WebSocket
  const setupWebSocket = useCallback(async (token?: string) => {
    try {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      setWsStatus('connecting');
      const wsUrl = await getWSURL(token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch (e) {
          console.warn('Failed to parse WS payload', e);
        }
      };

      ws.onerror = (e) => {
        console.warn('WebSocket error:', e);
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Reconnect after 3 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          setupWebSocket();
        }, 3000);
      };
    } catch (err) {
      console.warn('Failed to initialize WebSocket:', err);
      setWsStatus('disconnected');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        setupWebSocket();
      }, 4000);
    }
  }, []);

  const handleWebSocketMessage = (msg: any) => {
    const channelId = Number(msg.channel_id);

    // 1. New Message
    if (msg.type === 'chat_message' || msg.type === 'new_message') {
      const messageId = Number(msg.id || msg.message_id);

      // Update channel unread status in sidebar
      setChannels(prev =>
        prev.map(c => {
          if (c.id === channelId) {
            const isActive = activeChannelRef.current?.id === channelId;
            return {
              ...c,
              max_messages: messageId,
              unread_count: isActive ? 0 : (c.unread_count || 0) + 1
            };
          }
          return c;
        })
      );

      // Append to active channel messages
      if (activeChannelRef.current?.id === channelId) {
        setMessages(prev => {
          if (prev.find(m => m.id === messageId)) return prev;
          const formattedMsg: Message = {
            id: messageId,
            channel_id: channelId,
            from_user_id: Number(msg.from_user_id),
            message: msg.message || '',
            created_at: msg.created_at || new Date().toISOString(),
            files: msg.files || [],
            reactions: msg.reactions || [],
            reply_to_message_id: msg.reply_to_message_id,
            reply_to: msg.reply_to,
            is_edited: false,
            is_deleted: false
          };
          return [...prev, formattedMsg];
        });

        // Mark as read immediately if window active
        channelsApi.markRead(channelId, messageId);
      }
    }

    // 2. Reaction Update
    else if (msg.type === 'message_reaction') {
      const messageId = Number(msg.message_id);
      if (activeChannelRef.current?.id === channelId) {
        setMessages(prev =>
          prev.map(m => {
            if (m.id === messageId) {
              return {
                ...m,
                reactions: msg.reactions
              };
            }
            return m;
          })
        );
      }
    }

    // 3. Message Deleted
    else if (msg.type === 'message_deleted') {
      const messageId = Number(msg.message_id);
      if (activeChannelRef.current?.id === channelId) {
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, is_deleted: true, message: '' } : m))
        );
      }
    }

    // 4. Message Edited
    else if (msg.type === 'message_edited') {
      const messageId = Number(msg.message_id);
      if (activeChannelRef.current?.id === channelId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, is_edited: true, message: msg.message } : m
          )
        );
      }
    }

    // 5. User Typing
    else if (msg.type === 'user_typing') {
      const uid = Number(msg.user_id);
      if (activeChannelRef.current?.id === channelId) {
        // Clear previous timeout if exists
        setTypingUsers(prev => {
          if (prev[uid]?.timeout) clearTimeout(prev[uid].timeout);
          const t = setTimeout(() => {
            setTypingUsers(current => {
              const updated = { ...current };
              delete updated[uid];
              return updated;
            });
          }, 3000);
          return {
            ...prev,
            [uid]: { name: msg.user_name || 'Someone', timeout: t }
          };
        });
      }
    }
  };

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      try {
        const data = await coreApi.load();
        setChannels(data.channels);
        setUsers(data.users);
        setCurrentUserId(data.current_user_id);

        if (data.channels.length > 0) {
          // Default to first public channel if available
          const firstPublic = data.channels.find(c => c.visibility !== 'direct') || data.channels[0];
          setActiveChannel(firstPublic);
        }

        setupWebSocket(data.ws_token);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [setupWebSocket]);

  // Load Messages for Active Channel
  useEffect(() => {
    if (!activeChannel) return;

    const loadMessages = async () => {
      try {
        const msgs = await messagesApi.load(activeChannel.id);
        setMessages(msgs.reverse());
        // Mark channel as read
        channelsApi.markRead(activeChannel.id);
        // Reset unread count locally
        setChannels(prev =>
          prev.map(c => (c.id === activeChannel.id ? { ...c, unread_count: 0 } : c))
        );
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    loadMessages();
    setReplyingToMessage(null);
    setSearchQuery('');
    setIsSearchOpen(false);
  }, [activeChannel]);

  // Message Actions
  const handleSendMessage = async (text: string, files?: string[], replyToMessageId?: number) => {
    if (!activeChannel) return;
    try {
      const newMsg = await messagesApi.send(activeChannel.id, text, files, replyToMessageId);
      // Append optimistically if not already delivered by WS
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setReplyingToMessage(null);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleToggleReaction = async (messageId: number, reaction: string) => {
    if (!activeChannel) return;
    try {
      const res = await messagesApi.toggleReaction(activeChannel.id, messageId, reaction);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!activeChannel) return;
    try {
      await messagesApi.delete(activeChannel.id, messageId);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, is_deleted: true, message: '' } : m))
      );
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleEditMessage = async (messageId: number, newText: string) => {
    if (!activeChannel) return;
    try {
      await messagesApi.edit(activeChannel.id, messageId, newText);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, is_edited: true, message: newText } : m))
      );
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleTyping = () => {
    if (activeChannel) {
      messagesApi.sendTyping(activeChannel.id);
    }
  };

  // Channel Creation & Management
  const handleCreateChannel = async (name: string, description: string, visibility: string) => {
    const res = await channelsApi.create(name, description, visibility);
    const data = await coreApi.load();
    setChannels(data.channels);
    const newChan = data.channels.find(c => c.id === res.id || c.name === name);
    if (newChan) {
      setActiveChannel(newChan);
    }
  };

  const handleStartDirectChat = async (userId: number) => {
    const result = await usersApi.startDirectChat(userId);
    const data = await coreApi.load();
    setChannels(data.channels);
    setUsers(data.users);
    const targetChannel = data.channels.find(c => Number(c.id) === Number(result.channel_id));
    if (targetChannel) {
      setActiveChannel(targetChannel);
    }
  };

  const handleChannelDeleted = (channelId: number) => {
    setChannels(prev => prev.filter(c => c.id !== channelId));
    const remaining = channels.filter(c => c.id !== channelId && c.visibility !== 'direct');
    if (remaining.length > 0) {
      setActiveChannel(remaining[0]);
    }
  };

  const handleChannelLeft = (channelId: number) => {
    setChannels(prev => prev.filter(c => c.id !== channelId));
    const remaining = channels.filter(c => c.id !== channelId && c.visibility !== 'direct');
    if (remaining.length > 0) {
      setActiveChannel(remaining[0]);
    }
  };

  // Helper title & DM counterpart
  const getDirectChatUser = () => {
    if (!activeChannel || activeChannel.visibility !== 'direct') return null;
    const channelId = activeChannel.id;
    return users.find(u => Number(u.associated_channel) === Number(channelId));
  };

  const dmUser = getDirectChatUser();

  const getHeaderTitle = () => {
    if (!activeChannel) return 'No Channel Selected';
    if (activeChannel.visibility === 'direct') {
      return dmUser?.name || 'Direct Message';
    }
    return activeChannel.name;
  };

  // Filter messages if search query active
  const filteredMessages = searchQuery.trim()
    ? messages.filter(
        m =>
          m.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          users.find(u => u.id === m.from_user_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const typingNames = Object.values(typingUsers).map(u => u.name);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-4xl animate-bounce">🥔</div>
          <div className="text-sm font-semibold tracking-wide text-slate-300">
            Loading Potato Chat...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        channels={channels}
        users={users}
        activeChannel={activeChannel}
        currentUserId={currentUserId}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        onSelectChannel={(chan) => {
          setActiveChannel(chan);
          setIsMobileSidebarOpen(false);
        }}
        onCreateChannelClick={() => setIsCreateModalOpen(true)}
        onStartDirectChatClick={() => setIsDirectChatModalOpen(true)}
        onStartDirectChat={handleStartDirectChat}
      />

      {/* Main Conversation Container */}
      <div className="flex-1 flex flex-col bg-white min-w-0 h-full">
        {/* Airtable-like View Toolbar */}
        <header className="h-13 flex items-center justify-between px-3.5 md:px-5 border-b border-slate-200/90 bg-white z-10 flex-shrink-0 select-none">
          <div className="flex items-center space-x-2.5 truncate min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md md:hidden transition-colors"
              title="Open Navigation"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            {/* Desktop Sidebar Expand Button (only visible when sidebar is collapsed) */}
            {isSidebarCollapsed && (
              <button
                onClick={toggleSidebarCollapse}
                className="hidden md:flex p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors items-center justify-center"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4 text-slate-600" />
              </button>
            )}

            {/* Channel / DM Title and Status */}
            <div className="flex items-center space-x-2 truncate min-w-0">
              {activeChannel?.visibility === 'direct' && dmUser ? (
                <UserAvatar
                  userId={dmUser.id}
                  name={dmUser.name}
                  className="w-7 h-7"
                  showPresence
                  isOnline={dmUser.is_online}
                />
              ) : (
                <div className="w-7 h-7 rounded-md bg-[#eef2fe] text-[#2d7ff9] border border-blue-200/60 flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                  {activeChannel?.visibility === 'private' ? (
                    <Lock className="w-3.5 h-3.5 text-purple-600" />
                  ) : (
                    <Hash className="w-3.5 h-3.5 text-[#2d7ff9]" />
                  )}
                </div>
              )}

              <div className="flex items-center truncate min-w-0">
                <h2 className="font-semibold text-sm text-slate-900 tracking-tight truncate">
                  {getHeaderTitle()}
                </h2>

                <span className="hidden sm:inline-block h-3.5 w-px bg-slate-200 mx-2 flex-shrink-0" />

                <span className="hidden sm:inline-block text-xs text-slate-500 font-normal truncate max-w-xs md:max-w-md">
                  {activeChannel?.visibility === 'direct'
                    ? dmUser?.email || 'Direct Conversation'
                    : activeChannel?.description || 'Team channel'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {/* In-channel search input */}
            {isSearchOpen ? (
              <div className="relative flex items-center animate-in fade-in slide-in-from-right-3 duration-150">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7.5 pl-7 pr-6 text-xs border border-slate-200/90 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-36 sm:w-48 bg-slate-50 focus:bg-white shadow-2xs transition-all"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="h-7.5 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 text-xs"
                title="Search messages in this channel"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Channel Details / Info Button */}
            {activeChannel && activeChannel.visibility !== 'direct' && (
              <button
                onClick={() => setIsChannelDetailOpen(true)}
                className="h-7.5 px-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Channel Members & Topic"
              >
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Details</span>
              </button>
            )}

            {/* Connection Status Indicator */}
            <div
              className="h-6 px-2 rounded-full text-[11px] font-medium flex items-center shadow-2xs"
              title={
                wsStatus === 'connected'
                  ? 'Real-time WebSocket connected'
                  : wsStatus === 'connecting'
                  ? 'Connecting WebSocket...'
                  : 'Disconnected (will retry)'
              }
            >
              {wsStatus === 'connected' ? (
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden md:inline">Live</span>
                </span>
              ) : wsStatus === 'connecting' ? (
                <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span className="hidden md:inline">Connecting</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  <span className="hidden md:inline">Offline</span>
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Message Stream */}
        <MessageList
          messages={filteredMessages}
          users={users}
          currentUserId={currentUserId}
          activeChannelName={getHeaderTitle()}
          isDirectChat={activeChannel?.visibility === 'direct'}
          onReplyTo={(msg) => setReplyingToMessage(msg)}
          onToggleReaction={handleToggleReaction}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
        />

        {/* Typing Notification Pill */}
        {typingNames.length > 0 && (
          <div className="px-4 py-1 text-[11px] font-medium text-slate-500 bg-white border-t border-slate-100 flex items-center gap-1.5 animate-pulse">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
            <span>
              {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        {/* Message Input Form */}
        <MessageInput
          channelId={activeChannel?.id}
          channelName={getHeaderTitle()}
          isDirectChat={activeChannel?.visibility === 'direct'}
          replyingTo={replyingToMessage}
          onCancelReply={() => setReplyingToMessage(null)}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
        />
      </div>

      {/* Modals */}
      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateChannel}
      />

      <StartDirectChatModal
        isOpen={isDirectChatModalOpen}
        onClose={() => setIsDirectChatModalOpen(false)}
        onStartChat={handleStartDirectChat}
      />

      <ChannelDetailModal
        isOpen={isChannelDetailOpen}
        onClose={() => setIsChannelDetailOpen(false)}
        channelId={activeChannel?.id || null}
        currentUserId={currentUserId}
        onChannelDeleted={handleChannelDeleted}
        onChannelLeft={handleChannelLeft}
      />
    </div>
  );
};

export default ChatView;
