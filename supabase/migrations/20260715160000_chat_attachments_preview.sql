-- Chat Phase G: attachment architecture + conversation search preview.
-- Image upload storage is not enabled yet; columns/contracts are reserved.
-- Voice Conversation MUST reuse conversations/messages + chatEngine (no parallel schema).

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_url text NULL,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_preview text NOT NULL DEFAULT '';

COMMENT ON COLUMN messages.image_url IS
  'Optional primary image URL for a message. Upload pipeline deferred until Storage bucket + RLS are ready.';
COMMENT ON COLUMN messages.attachments IS
  'JSON array of ChatAttachment-shaped objects (image/audio/file). Architecture placeholder for voice+images.';
COMMENT ON COLUMN conversations.last_message_preview IS
  'Short plain-text preview used for conversation search in the sidebar.';
