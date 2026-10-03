import React, { useEffect, useRef, useState } from 'react';
import type { Message, User } from '../lib/api';
import { 
  isImageFile, 
  getFilePreviewUrl, 
  getFileDownloadUrl, 
  formatFileSize 
} from '../lib/api';
import UserAvatar from './UserAvatar';
import { 
  Smile, 
  Reply, 
  Download, 
  FileText, 
  FileArchive, 
  FileCode, 
  File, 
  Check, 
  Copy, 
  Pencil, 
  Trash2, 
  ExternalLink, 
  X,
  Maximize2
} from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  users: User[];
  currentUserId?: number;
  activeChannelName: string;
  isDirectChat?: boolean;
  onReplyTo?: (message: Message) => void;
  onToggleReaction?: (messageId: number, reaction: string) => void;
  onDeleteMessage?: (messageId: number) => void;
  onEditMessage?: (messageId: number, newText: string) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🚀', '👀'];

const formatMessageTime = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatMessageDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
};

// Simple markdown-style rendering for text
const FormattedMessageText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split into lines to detect code blocks or inline markdown
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  lines.forEach((line, lineIndex) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        renderedElements.push(
          <div key={`codeblock-${lineIndex}`} className="my-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
            <pre>{codeBlockBuffer.join('\n')}</pre>
          </div>
        );
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      return;
    }

    // Format inline markdown (bold, code, links)
    const formattedLine = formatInlineText(line, lineIndex);
    renderedElements.push(
      <span key={`line-${lineIndex}`} className="block">
        {formattedLine || '\u00A0'}
      </span>
    );
  });

  if (inCodeBlock && codeBlockBuffer.length > 0) {
    renderedElements.push(
      <div key="unclosed-codeblock" className="my-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
        <pre>{codeBlockBuffer.join('\n')}</pre>
      </div>
    );
  }

  return <div className="leading-relaxed whitespace-pre-wrap">{renderedElements}</div>;
};

function formatInlineText(text: string, keyPrefix: number): React.ReactNode {
  // Simple regex for URL matching
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={`${keyPrefix}-url-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-0.5"
        >
          {part}
          <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
        </a>
      );
    }

    // Inline code `code`
    const codeParts = part.split(/`([^`]+)`/g);
    if (codeParts.length > 1) {
      return codeParts.map((sub, j) => {
        if (j % 2 === 1) {
          return (
            <code key={`${keyPrefix}-code-${i}-${j}`} className="px-1.5 py-0.5 bg-slate-100 text-pink-600 rounded text-xs font-mono border border-slate-200">
              {sub}
            </code>
          );
        }
        return sub;
      });
    }

    return part;
  });
}

const getFileIcon = (ftype: string, fileName?: string) => {
  const name = fileName?.toLowerCase() || '';
  if (ftype === 'pdf' || name.endsWith('.pdf')) {
    return <FileText className="w-5 h-5 text-red-500" />;
  }
  if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz') || name.endsWith('.rar')) {
    return <FileArchive className="w-5 h-5 text-amber-500" />;
  }
  if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.json') || name.endsWith('.html') || name.endsWith('.lua')) {
    return <FileCode className="w-5 h-5 text-blue-500" />;
  }
  return <File className="w-5 h-5 text-slate-500" />;
};

const MessageList: React.FC<MessageListProps> = ({
  messages,
  users,
  currentUserId,
  activeChannelName,
  isDirectChat,
  onReplyTo,
  onToggleReaction,
  onDeleteMessage,
  onEditMessage
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<number | null>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const getUser = (userId: number): User | undefined => {
    return users.find(u => Number(u.id) === Number(userId));
  };

  const getUserName = (userId: number): string => {
    const user = getUser(userId);
    return user ? user.name : `User ${userId}`;
  };

  const handleCopyText = (msg: Message) => {
    navigator.clipboard.writeText(msg.message);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.message);
  };

  const handleSaveEdit = (messageId: number) => {
    if (editingText.trim()) {
      onEditMessage?.(messageId, editingText.trim());
    }
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleScrollToMessage = (messageId: number) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-blue-50/80');
      setTimeout(() => {
        el.classList.remove('bg-blue-50/80');
      }, 1500);
    }
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 bg-white relative">
      {/* Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Full resolution"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={lightboxImageUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm flex items-center gap-2 backdrop-blur-xs transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-4 h-4" /> Download image
            </a>
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4 shadow-inner">
            {isDirectChat ? '💬' : '🚀'}
          </div>
          <h3 className="text-lg font-bold text-slate-700">
            {isDirectChat ? `This is the start of your chat` : `Welcome to #${activeChannelName}!`}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm text-center mt-1">
            Send a message, share photos, or upload documents to get the conversation going.
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const sameSender =
            prevMsg &&
            prevMsg.from_user_id === msg.from_user_id &&
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

          // Check if date changed
          const showDateDivider =
            !prevMsg ||
            new Date(prevMsg.created_at).toDateString() !== new Date(msg.created_at).toDateString();

          const isAuthor = currentUserId ? Number(msg.from_user_id) === Number(currentUserId) : false;
          const isDeleted = msg.is_deleted;
          const senderUser = getUser(msg.from_user_id);

          // Group reactions by reaction emoji
          const reactionsMap = (msg.reactions || []).reduce<Record<string, { count: number; userIds: number[]; reactedByMe: boolean }>>(
            (acc, r) => {
              if (!acc[r.reaction]) {
                acc[r.reaction] = { count: 0, userIds: [], reactedByMe: false };
              }
              acc[r.reaction].count += 1;
              acc[r.reaction].userIds.push(r.user_id);
              if (currentUserId && Number(r.user_id) === Number(currentUserId)) {
                acc[r.reaction].reactedByMe = true;
              }
              return acc;
            },
            {}
          );

          return (
            <React.Fragment key={msg.id}>
              {/* Date divider line */}
              {showDateDivider && (
                <div className="relative my-5 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200/80" />
                  </div>
                  <span className="relative px-3 py-0.5 rounded-full bg-slate-50 text-[11px] font-medium text-slate-500 shadow-2xs border border-slate-200 select-none">
                    {formatMessageDate(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message Row */}
              <div
                id={`msg-${msg.id}`}
                className={`group relative flex items-start px-3 py-1.5 -mx-2 rounded-lg transition-colors duration-100 ${
                  sameSender ? 'mt-0.5' : 'mt-2.5'
                } hover:bg-slate-50/90`}
              >
                {/* Potatoverse Profile Image Avatar */}
                {!sameSender ? (
                  <UserAvatar
                    userId={msg.from_user_id}
                    name={getUserName(msg.from_user_id)}
                    className="w-7.5 h-7.5 mr-2.5"
                  />
                ) : (
                  <div className="w-7.5 mr-2.5 flex-shrink-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-slate-400">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                )}

                {/* Message Content */}
                <div className="flex-1 min-w-0 pr-12">
                  {/* Sender Header */}
                  {!sameSender && (
                    <div className="flex items-baseline space-x-2 mb-0.5">
                      <span className="font-semibold text-[13px] text-slate-900 hover:text-blue-600 transition-colors cursor-pointer">
                        {getUserName(msg.from_user_id)}
                      </span>
                      {senderUser?.is_self && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded border border-slate-200/80 font-medium">
                          you
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-normal">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                  )}

                  {/* Replied Message Quote (Airtable Linked Record Style) */}
                  {msg.reply_to && (
                    <div
                      onClick={() => handleScrollToMessage(msg.reply_to!.id)}
                      className="mb-1.5 px-2.5 py-1 rounded-md bg-slate-50/90 border border-slate-200/70 border-l-3 border-l-blue-500 text-xs text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors flex items-center space-x-1.5 max-w-xl truncate shadow-2xs"
                      title="Click to jump to replied message"
                    >
                      <Reply className="w-3 h-3 text-blue-500 flex-shrink-0 rotate-180" />
                      <span className="font-semibold text-slate-700 flex-shrink-0">
                        {getUserName(msg.reply_to.from_user_id)}:
                      </span>
                      <span className="truncate italic text-slate-500">
                        {msg.reply_to.message || '[Attachment]'}
                      </span>
                    </div>
                  )}

                  {/* Message Body or Edit Mode */}
                  {isDeleted ? (
                    <p className="text-sm italic text-slate-400 select-none">
                      (This message was deleted)
                    </p>
                  ) : editingMessageId === msg.id ? (
                    <div className="mt-1 flex flex-col space-y-2 max-w-xl">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEdit(msg.id);
                          } else if (e.key === 'Escape') {
                            setEditingMessageId(null);
                          }
                        }}
                        className="w-full p-2.5 border border-blue-400 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex items-center space-x-2 text-xs">
                        <button
                          onClick={() => handleSaveEdit(msg.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                        <span className="text-slate-400">Esc to cancel • Enter to save</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-800">
                      <FormattedMessageText text={msg.message} />
                      {msg.is_edited && (
                        <span className="text-[10px] text-slate-400 ml-1.5 italic select-none">
                          (edited)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Attachments */}
                  {!isDeleted && msg.files && msg.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2.5">
                      {msg.files.map((file, i) => {
                        const isImg = isImageFile(file);
                        const previewUrl = getFilePreviewUrl(file.file_url_or_id);
                        const downloadUrl = getFileDownloadUrl(file.file_url_or_id);

                        if (isImg) {
                          return (
                            <div
                              key={file.id || i}
                              className="relative group/img rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-xs max-w-sm cursor-pointer"
                              onClick={() => setLightboxImageUrl(previewUrl)}
                            >
                              <img
                                src={previewUrl}
                                alt={file.file_name || 'Attached image'}
                                className="max-h-64 rounded-xl object-contain hover:scale-[1.01] transition-transform duration-150"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-3 text-white">
                                <span className="p-2 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-xs transition-colors" title="Zoom">
                                  <Maximize2 className="w-4 h-4" />
                                </span>
                                <a
                                  href={downloadUrl}
                                  download={file.file_name || 'image'}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-xs transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          );
                        }

                        // File card attachment
                        return (
                          <div
                            key={file.id || i}
                            className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl max-w-xs transition-colors shadow-xs"
                          >
                            <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex-shrink-0">
                              {getFileIcon(file.ftype, file.file_name)}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-semibold text-slate-800 truncate" title={file.file_name}>
                                {file.file_name || 'Attached document'}
                              </span>
                              <span className="text-[11px] text-slate-400 uppercase">
                                {file.file_size ? formatFileSize(file.file_size) : file.ftype}
                              </span>
                            </div>
                            <a
                              href={downloadUrl}
                              download={file.file_name || 'attachment'}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors flex-shrink-0"
                              title="Download file"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reaction Pills (Airtable Multi-select Tag Style) */}
                  {!isDeleted && Object.keys(reactionsMap).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                      {Object.entries(reactionsMap).map(([emoji, info]) => (
                        <button
                          key={emoji}
                          onClick={() => onToggleReaction?.(msg.id, emoji)}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                            info.reactedByMe
                              ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                          title={info.userIds.map(id => getUserName(id)).join(', ')}
                        >
                          <span>{emoji}</span>
                          <span className="text-[11px] font-semibold">{info.count}</span>
                        </button>
                      ))}

                      <button
                        onClick={() =>
                          setActiveReactionPickerId(activeReactionPickerId === msg.id ? null : msg.id)
                        }
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Add reaction"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Airtable-style Floating Action Toolbar */}
                {!isDeleted && (
                  <div className="absolute right-3 -top-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                    <div className="flex items-center bg-white border border-slate-200/90 rounded-lg shadow-sm px-1 py-0.5 space-x-0.5">
                      {/* Quick Reactions */}
                      {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => onToggleReaction?.(msg.id, emoji)}
                          className="p-1 hover:bg-slate-100 rounded text-xs transition-transform hover:scale-120"
                        >
                          {emoji}
                        </button>
                      ))}

                      <span className="w-px h-3.5 bg-slate-200 mx-0.5" />

                      {/* Reply Button */}
                      <button
                        onClick={() => onReplyTo?.(msg)}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5 rotate-180" />
                      </button>

                      {/* Copy Text Button */}
                      <button
                        onClick={() => handleCopyText(msg)}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Edit Button (if author) */}
                      {isAuthor && (
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          title="Edit message"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete Button (if author or admin) */}
                      {(isAuthor || senderUser?.is_self) && (
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this message?')) {
                              onDeleteMessage?.(msg.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
