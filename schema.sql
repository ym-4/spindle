-- ─────────────────────────────────────────────────────────
--  Database Schema
-- ─────────────────────────────────────────────────────────
--  Single source of truth for the database structure.
--  Update this file whenever you add, remove, or change
--  tables, columns, or indexes.
--
--  Used by: scripts/reset.js
-- ─────────────────────────────────────────────────────────

-- Drop existing tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Create tables
CREATE TABLE "Something" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Something_pkey" PRIMARY KEY ("id")
);

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TABLE "Person" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "display_name" TEXT,
  "avatar" TEXT,
  "profile_image" TEXT,
  "bio" TEXT DEFAULT '',
  "cover_image" TEXT,
  "headline" TEXT DEFAULT '',
  "location" TEXT DEFAULT '',
  "skills" JSONB DEFAULT '[]'::jsonb,
  "link_portfolio" TEXT DEFAULT '',
  "link_github" TEXT DEFAULT '',
  "link_linkedin" TEXT DEFAULT '',
  "hashed_password" TEXT NOT NULL DEFAULT '1234',
  "role" user_role NOT NULL DEFAULT 'user',
  "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "deleted_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationCodes" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "code" VARCHAR(6) NOT NULL,
  "purpose" VARCHAR(20) NOT NULL DEFAULT 'email_verify',
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationCodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrustedDevices" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustedDevices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrustedDevices_token_hash_key" UNIQUE ("token_hash"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "UserSessions" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "device_label" TEXT DEFAULT 'Unknown device',
  "user_agent" TEXT,
  "ip_address" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "last_active" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSessions_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

-- -------------------------------------------------------------------------------------
--                                  POSTS
-- -------------------------------------------------------------------------------------

CREATE TYPE post_categories AS ENUM ('confession', 'qna', 'general');

CREATE TABLE "Posts" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "title" VARCHAR(255) NOT NULL, 
  "category" post_categories NOT NULL, 
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "content" TEXT NOT NULL,
  "attachment_url" TEXT,
  "is_anonymous" BOOLEAN DEFAULT FALSE,
  CONSTRAINT "Posts_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

-- Auto updates updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON "Posts"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TABLE "PostComments" (
  "id" SERIAL NOT NULL, 
  "user_id" INT NOT NULL,
  "post_id" INT NOT NULL,
  "parent_comment_id" INT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostComments_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("post_id") REFERENCES "Posts"("id") ON DELETE CASCADE,
  FOREIGN KEY ("parent_comment_id") REFERENCES "PostComments"("id") ON DELETE CASCADE
);

CREATE TYPE reaction_types AS ENUM ('like', 'dislike');

CREATE TABLE "PostReactions" (
  "id" SERIAL NOT NULL,
  "post_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "reaction_type" reaction_types NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("post_id") REFERENCES "Posts"("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  CONSTRAINT "PostReactions_pkey" PRIMARY KEY ("id"),
  UNIQUE ("post_id", "user_id")
);

CREATE TABLE "SavedPosts" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "post_id" INT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("post_id") REFERENCES "Posts"("id") ON DELETE CASCADE,
  CONSTRAINT "SavedPosts_pkey" PRIMARY KEY ("id"), 
  UNIQUE(user_id, post_id)
);

CREATE TABLE "Reports" (
  "id"        SERIAL PRIMARY KEY,
  "post_id"   INT NOT NULL REFERENCES "Posts"("id") ON DELETE CASCADE,
  "user_id"   INT NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
  "reason"    VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("post_id", "user_id")
);
-- -------------------------------------------------------------------------------------
--                                  GROUPS
-- -------------------------------------------------------------------------------------

CREATE TYPE school_choices AS ENUM ('SOC', 'MAD', 'EEE', 'ABE', 'SB', 'SMA', 'MAE', 'CLS');

CREATE TABLE "Groups" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "creator_id" INT NOT NULL,
  "description" TEXT NOT NULL, 
  "school" school_choices NOT NULL, 
  "module" TEXT NOT NULL, 
  "public" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "Groups_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("creator_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  UNIQUE ("name")
);

CREATE TYPE join_status AS ENUM ('pending', 'accepted', 'denied');

CREATE TABLE "GroupJoinRequests" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "group_id" INT NOT NULL, 
  "status" join_status NOT NULL DEFAULT 'pending', 
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  CONSTRAINT "GroupJoinRequest_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE, 
  UNIQUE ("user_id", "group_id")
);

CREATE TYPE member_role AS ENUM ('user', 'admin');

CREATE TABLE "GroupMembers" (
  "group_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "role" member_role NOT NULL,
  CONSTRAINT "GroupMembers_pkey" PRIMARY KEY ("group_id", "user_id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE
);

CREATE TABLE "GroupDiscussions" (
  "id" SERIAL NOT NULL,
  "group_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "channel_name" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  CONSTRAINT "GroupDiscussions_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE
);

CREATE TABLE "GroupFiles" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "group_id" INT NOT NULL,
  "description" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  CONSTRAINT "GroupFiles_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE
);

CREATE TABLE "GroupAnnouncements" (
  "announcement_id" SERIAL,
  "user_id" INT NOT NULL,
  "group_id" INT NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupAnnouncements_pkey" PRIMARY KEY ("announcement_id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE
);

---------------------------------------------------------------------------------------
--                                  USER
-- -------------------------------------------------------------------------------------


CREATE TABLE "UserSettings" (
  "user_id" INT NOT NULL,
  "bio" TEXT DEFAULT '',
  "phone" TEXT DEFAULT '',
  "campus" TEXT DEFAULT '',
  "language" TEXT DEFAULT 'en',
  "timezone" TEXT DEFAULT 'Asia/Singapore',
  "two_factor_enabled" BOOLEAN DEFAULT FALSE,
  "login_notifications" BOOLEAN DEFAULT TRUE,
  "notify_email" BOOLEAN DEFAULT TRUE,
  "notify_product" BOOLEAN DEFAULT FALSE,
  "notify_security" BOOLEAN DEFAULT TRUE,
  "notify_frequency" TEXT DEFAULT 'weekly',
  "theme" TEXT DEFAULT 'dark',
  "compact_mode" BOOLEAN DEFAULT FALSE,
  "font_size" TEXT DEFAULT 'medium',
  "public_profile" BOOLEAN DEFAULT TRUE,
  "activity_tracking" BOOLEAN DEFAULT TRUE,
  "cookie_preferences" TEXT DEFAULT 'essential',
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("user_id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE "FriendRequests" (
  "id" SERIAL NOT NULL,
  "sender_id" INT NOT NULL,
  "receiver_id" INT NOT NULL,
  "status" friend_request_status NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendRequests_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("sender_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("receiver_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  UNIQUE ("sender_id", "receiver_id")
);

CREATE TABLE "UserPaymentDetails" (
  "user_id" INT NOT NULL,
  "billing_name" TEXT DEFAULT '',
  "payment_method" TEXT DEFAULT '',
  "card_last4" VARCHAR(4) DEFAULT '',
  CONSTRAINT "UserPaymentDetails_pkey" PRIMARY KEY ("user_id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);


-- -------------------------------------------------------------------------------------
--                                  Marketplace Items
-- -------------------------------------------------------------------------------------

CREATE TABLE "MarketplaceItems" (
  "id" SERIAL NOT NULL,
  "seller_id" INT NOT NULL, -- User ID
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" NUMERIC(10, 2) NOT NULL,
  "quality" TEXT NOT NULL,
  "meetup" TEXT NOT NULL,
  CONSTRAINT "MarketplaceItems_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("seller_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "UserCart" (
  "id" SERIAL NOT NULL,
  "seller_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "item_id" INT NOT NULL,
  "amount" INT NOT NULL,
  CONSTRAINT "UserCart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT unique_user_item UNIQUE (user_id, item_id),
  FOREIGN KEY ("seller_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("item_id") REFERENCES "MarketplaceItems"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Tags" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS "ItemTags" (
  "item_id" INTEGER NOT NULL REFERENCES "MarketplaceItems"("id") ON DELETE CASCADE,
  "tag_id" INTEGER NOT NULL REFERENCES "Tags"("id") ON DELETE CASCADE,
  CONSTRAINT "ItemTags_pkey" PRIMARY KEY ("item_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON "ItemTags"("tag_id");

CREATE TABLE IF NOT EXISTS "ListingImages" (
  "id" SERIAL PRIMARY KEY,
  "item_id" INTEGER NOT NULL REFERENCES "MarketplaceItems"("id") ON DELETE CASCADE,
  "image_url" TEXT NOT NULL,
  "sort_order" INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listing_images_item_id ON "ListingImages"("item_id");

CREATE TYPE order_status AS ENUM ('pending', 'paid', 'failed');

-- CREATE TABLE IF NOT EXISTS "Orders" (
--   "id" SERIAL PRIMARY KEY,
--   "buyer_id" INT NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
--   "total_amount" NUMERIC(10,2) NOT NULL,
--   "status" order_status NOT NULL DEFAULT 'pending',
--   "payment_ref" TEXT,
--   "card_last4" VARCHAR(4),
--   "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE TABLE IF NOT EXISTS "OrderItems" (
--   "id" SERIAL PRIMARY KEY,
--   "order_id" INT NOT NULL REFERENCES "Orders"("id") ON DELETE CASCADE,
--   "item_id" INT NOT NULL REFERENCES "MarketplaceItems"("id"),
--   "seller_id" INT NOT NULL REFERENCES "Person"("id"),
--   "quantity" INT NOT NULL,
--   "price_at_purchase" NUMERIC(10,2) NOT NULL
-- );

-- CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON "OrderItems"("order_id");
-- CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON "Orders"("buyer_id");

-- -------------------------------------------------------------------------------------
--                                  Chatroom
-- -------------------------------------------------------------------------------------

CREATE TABLE "Chatroom" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Chatroom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatroomMessages" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "chatroom_id" INT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "ChatroomMessages_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("chatroom_id") REFERENCES "Chatroom"("id") ON DELETE CASCADE
);

-- -------------------------------------------------------------------------------------
--                                  Friends
-- -------------------------------------------------------------------------------------

CREATE TABLE "UserFriends" (
  "user_id" INT NOT NULL,
  "friend_id" INT NOT NULL,
  "status" TEXT DEFAULT 'pending',
  CONSTRAINT "UserFriends_pkey" PRIMARY KEY ("user_id", "friend_id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("friend_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

-- Direct personal messages between users (WhatsApp-style PMs)
CREATE TABLE "PersonalMessages" (
  "id" SERIAL NOT NULL,
  "sender_id" INT NOT NULL,
  "recipient_id" INT NOT NULL,
  "body" TEXT NOT NULL,
  "edited_at" TIMESTAMP,
  "deleted_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonalMessages_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("sender_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("recipient_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  CHECK ("sender_id" <> "recipient_id")
);

CREATE INDEX "PersonalMessages_conversation_idx"
  ON "PersonalMessages" ("sender_id", "recipient_id", "created_at");

CREATE TABLE "MessageReadState" (
  "user_id" INT NOT NULL,
  "peer_id" INT NOT NULL,
  "last_read_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReadState_pkey" PRIMARY KEY ("user_id", "peer_id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("peer_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "MessageReactions" (
  "id" SERIAL NOT NULL,
  "message_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "emoji" VARCHAR(16) NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageReactions_message_user_key" UNIQUE ("message_id", "user_id"),
  FOREIGN KEY ("message_id") REFERENCES "PersonalMessages"("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "CallLogs" (
  "id" SERIAL NOT NULL,
  "caller_id" INT NOT NULL,
  "callee_id" INT NOT NULL,
  "call_type" VARCHAR(10) NOT NULL DEFAULT 'voice',
  "status" VARCHAR(20) NOT NULL,
  "duration_sec" INT DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallLogs_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("caller_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("callee_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "Notifications" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT DEFAULT '',
  "ref_id" INT,
  "read" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE INDEX "Notifications_user_idx" ON "Notifications" ("user_id", "read", "created_at" DESC);

CREATE TABLE "Stories" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "media_url" TEXT NOT NULL,
  "caption" TEXT DEFAULT '',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP NOT NULL,
  CONSTRAINT "Stories_pkey" PRIMARY KEY ("id")
);
-- -------------------------------------------------------------------------------------
--                             Other (for later sprints)
-- -------------------------------------------------------------------------------------

CREATE TABLE "Timetable" (
  "id" SERIAL NOT NULL, 
  "user_id" INT NOT NULL,
  "subject" TEXT NOT NULL,
  "day_of_week" INT NOT NULL,
  "start_time" INT NOT NULL,
  "end_time" INT NOT NULL,
  "location" TEXT NOT NULL,
  CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "AILogs" (
  "id" SERIAL NOT NULL, 
  "user_id" INT NOT NULL,
  "prompt" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AILogs_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "Events" (
  "id" SERIAL NOT NULL, 
  "creator_id" INT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "event_date" TIMESTAMP NOT NULL,
  "location" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Events_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("creator_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "Flashcards" (
  "id" SERIAL NOT NULL, 
  "user_id" INT NOT NULL,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Flashcards_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "FlashcardItems" (
  "id" SERIAL NOT NULL, 
  "flashcard_id" INT NOT NULL,
  "front" TEXT NOT NULL,
  "back" TEXT NOT NULL,
  CONSTRAINT "FlashcardItems_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("flashcard_id") REFERENCES "Flashcards"("id") ON DELETE CASCADE
);

CREATE TABLE "Quizzes" (
  "id" SERIAL NOT NULL, 
  "creator_id" INT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Quizzes_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("creator_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "QuizQuestions" (
  "id" SERIAL NOT NULL, 
  "quiz_id" INT NOT NULL,
  "question" TEXT NOT NULL,
  "option_a" TEXT NOT NULL,
  "option_b" TEXT NOT NULL,
  "option_c" TEXT NOT NULL,
  "option_d" TEXT NOT NULL,
  "correct_option" TEXT NOT NULL,
  CONSTRAINT "QuizQuestions_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("quiz_id") REFERENCES "Quizzes"("id") ON DELETE CASCADE
);

CREATE TABLE "QuizAttempts" (
  "id" SERIAL NOT NULL, 
  "quiz_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "score" INT NOT NULL,
  "attempted_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempts_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("quiz_id") REFERENCES "Quizzes"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
CREATE INDEX ON "Posts"("user_id");
CREATE INDEX ON "PostComments"("post_id");
CREATE INDEX ON "GroupDiscussions"("group_id");
CREATE INDEX ON "MarketplaceItems"("seller_id");
CREATE INDEX ON "ChatroomMessages"("chatroom_id");