-- Add file metadata columns to chat_channel_files
ALTER TABLE chat_channel_files ADD COLUMN file_name text default null;
ALTER TABLE chat_channel_files ADD COLUMN file_size int default 0;
