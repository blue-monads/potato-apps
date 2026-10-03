import React, { useState, useRef, useEffect } from 'react';
import { 
  messagesApi, 
  formatFileSize, 
  openSpaceFilePicker, 
  getFilePreviewUrl,
  type Message, 
  type SpaceFile 
} from '../lib/api';
import { 
  Paperclip, 
  FolderOpen,
  Smile, 
  Send, 
  X, 
  Bold, 
  Italic, 
  Code, 
  FileText, 
  Loader2,
  Reply
} from 'lucide-react';

interface MessageInputProps {
  channelId?: number;
  channelName: string;
  isDirectChat?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  onSendMessage: (message: string, files?: string[], replyToMessageId?: number) => void;
  onTyping?: () => void;
}

interface AttachedFile {
  id: string;
  name: string;
  size?: number;
  file?: File;
  token?: string;
  uploading: boolean;
  previewUrl?: string;
  error?: string;
}

const COMMON_EMOJIS = [
  '😀', '😂', '😍', '🥳', '😎', '🤔', '👍', '👎', 
  '👏', '🙌', '🔥', '✨', '🎉', '❤️', '💯', '🚀',
  '👀', '💡', '✅', '❌', '🍕', '☕', '🌟', '💪'
];

const MessageInput: React.FC<MessageInputProps> = ({
  channelId,
  channelName,
  isDirectChat,
  replyingTo,
  onCancelReply,
  onSendMessage,
  onTyping
}) => {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto focus input when channel or reply changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [channelId, replyingTo]);

  const handleSend = () => {
    const validTokens = attachedFiles.filter(f => f.token && !f.error).map(f => f.token as string);
    if (message.trim() || validTokens.length > 0) {
      onSendMessage(
        message.trim(),
        validTokens.length > 0 ? validTokens : undefined,
        replyingTo ? replyingTo.id : undefined
      );
      setMessage('');
      setAttachedFiles([]);
      onCancelReply?.();
      setShowEmojiPicker(false);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-grow textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;

    // Trigger typing event with throttle
    if (onTyping) {
      if (!typingTimeoutRef.current) {
        onTyping();
        typingTimeoutRef.current = setTimeout(() => {
          typingTimeoutRef.current = null;
        }, 3000);
      }
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!channelId || files.length === 0) return;

    const newAttached: AttachedFile[] = files.map(f => {
      let previewUrl: string | undefined = undefined;
      if (f.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(f);
      }
      return {
        id: Math.random().toString(36).substring(7),
        name: f.name,
        size: f.size,
        file: f,
        previewUrl,
        uploading: true
      };
    });

    setAttachedFiles(prev => [...prev, ...newAttached]);

    for (const item of newAttached) {
      try {
        const res = await messagesApi.uploadFile(channelId, item.file!);
        setAttachedFiles(prev =>
          prev.map(a => (a.id === item.id ? { ...a, uploading: false, token: res.token } : a))
        );
      } catch (err) {
        console.error('Upload failed', err);
        setAttachedFiles(prev =>
          prev.map(a =>
            a.id === item.id ? { ...a, uploading: false, error: 'Upload failed' } : a
          )
        );
      }
    }
  };

  const handlePickSpaceFile = () => {
    if (!channelId) return;
    openSpaceFilePicker((spaceFile: SpaceFile) => {
      const isImg = spaceFile.mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(spaceFile.name);
      setAttachedFiles(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          name: spaceFile.name,
          size: spaceFile.size,
          uploading: false,
          previewUrl: isImg ? getFilePreviewUrl(spaceFile.id) : undefined,
          token: spaceFile.id
        }
      ]);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = message.substring(0, start) + emoji + message.substring(end);
    setMessage(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end) || 'text';
    const newText =
      message.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      message.substring(end);
    setMessage(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const isSendingDisabled =
    (!message.trim() && attachedFiles.filter(f => f.token).length === 0) ||
    attachedFiles.some(f => f.uploading);

  return (
    <div
      className="px-3.5 md:px-5 py-2.5 bg-white border-t border-slate-200/90 relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-50/90 border-2 border-dashed border-[#2d7ff9] rounded-xl flex items-center justify-center z-30 backdrop-blur-2xs pointer-events-none mx-3.5 md:mx-5">
          <div className="text-[#2d7ff9] font-semibold text-sm flex items-center gap-2">
            <Paperclip className="w-5 h-5 animate-bounce" /> Drop files here to upload
          </div>
        </div>
      )}

      {/* Replying banner (Airtable Linked Record Style) */}
      {replyingTo && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-[#eef2fe]/80 border border-blue-200/80 text-xs text-slate-700 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-[#2d7ff9] rotate-180 flex-shrink-0" />
            <span className="font-semibold text-blue-900">Replying to message:</span>
            <span className="truncate italic text-slate-600">
              {replyingTo.message || '[Attachment]'}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-blue-100 transition-colors ml-2"
            title="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Input Box (Airtable Formula / Record Editor Style) */}
      <div className="border border-slate-200/90 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 shadow-xs transition-all overflow-hidden flex flex-col bg-white">
        {/* Attached Files Strip */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2.5 pb-2 border-b border-slate-100 bg-slate-50/80">
            {attachedFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs group"
              >
                {file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt="preview"
                    className="w-7 h-7 rounded object-cover flex-shrink-0 border border-slate-100"
                  />
                ) : (
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}

                <div className="flex flex-col truncate max-w-[130px]">
                  <span className="truncate text-slate-700 font-medium">{file.name}</span>
                  <span className="text-[10px] text-slate-400">
                    {formatFileSize(file.size)}
                  </span>
                </div>

                {file.uploading && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                )}
                {file.error && (
                  <span className="text-[10px] text-red-500 font-medium">Failed</span>
                )}

                <button
                  onClick={() => removeFile(file.id)}
                  className="p-0.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          className="w-full px-3 py-2.5 resize-none outline-none max-h-36 bg-transparent text-sm text-slate-800 placeholder-slate-400 leading-relaxed"
          placeholder={
            isDirectChat
              ? `Message @${channelName}...`
              : `Message #${channelName}...`
          }
          rows={1}
          value={message}
          onChange={handleTextChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!isSendingDisabled) handleSend();
            }
          }}
        />

        {/* Toolbar & Action Bar */}
        <div className="px-2.5 py-1.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          {/* Formatting & Insert Actions */}
          <div className="flex items-center space-x-0.5 text-slate-500">
            <button
              type="button"
              onClick={() => applyFormatting('**')}
              className="p-1.5 rounded-md hover:bg-slate-200 hover:text-slate-800 transition-colors"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('*')}
              className="p-1.5 rounded-md hover:bg-slate-200 hover:text-slate-800 transition-colors"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('`')}
              className="p-1.5 rounded-md hover:bg-slate-200 hover:text-slate-800 transition-colors"
              title="Inline Code"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-slate-300 mx-1" />

            {/* File upload button */}
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-slate-200 hover:text-slate-800 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              title="Attach local files"
              disabled={!channelId}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Space Files picker button */}
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-slate-200 hover:text-slate-800 transition-colors"
              onClick={handlePickSpaceFile}
              title="Browse Space Files (Potatoverse Drive)"
              disabled={!channelId}
            >
              <FolderOpen className="w-4 h-4" />
            </button>

            {/* Emoji picker button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-1.5 rounded-md transition-colors ${
                  showEmojiPicker
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-slate-200 hover:text-slate-800'
                }`}
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-9 left-0 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 w-64 grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-lg p-1 rounded hover:bg-slate-100 hover:scale-120 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Send Button (Airtable Signature Action Style) */}
          <button
            onClick={handleSend}
            disabled={isSendingDisabled}
            className={`px-3 py-1.5 rounded-md transition-all font-semibold text-xs flex items-center gap-1.5 shadow-2xs ${
              !isSendingDisabled
                ? 'bg-[#2d7ff9] text-white hover:bg-[#1b6fe5] active:scale-95 cursor-pointer shadow-blue-500/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/60'
            }`}
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
