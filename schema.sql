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

CREATE TABLE "Person" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bio" TEXT,
  "hashed_password" TEXT NOT NULL DEFAULT '1234', 
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
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

CREATE TABLE PostReactions (
  "id" SERIAL NOT NULL,
  "post_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "reaction_type" reaction_types NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("post_id") REFERENCES "Posts"("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  CONSTRAINT "PostReactions_pkey" PRIMARY KEY ("id"), 
  UNIQUE(post_id, user_id)
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

-- -------------------------------------------------------------------------------------
--                                  CONFESSIONS
-- -------------------------------------------------------------------------------------

CREATE TABLE "Confessions" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "details" TEXT NOT NULL,
  CONSTRAINT "Confessions_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE

);

CREATE TABLE "ConfessionComments" (
  "id" SERIAL NOT NULL, 
  "confession_id" INT NOT NULL,
  "user_id" INT NOT NULL,
  "details" TEXT NOT NULL,
  CONSTRAINT "ConfessionComments_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("confession_id") REFERENCES "Confessions"("id") ON DELETE CASCADE
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
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  CONSTRAINT "GroupDiscussions_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE
);

CREATE TABLE "GroupFiles" (
  "id" SERIAL NOT NULL,
  "group_id" INT NOT NULL,
  "creator_id" INT NOT NULL,
  "description" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  CONSTRAINT "GroupFiles_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("creator_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE
);

-- -------------------------------------------------------------------------------------
--                                  Marketplace Items
-- -------------------------------------------------------------------------------------

CREATE TABLE "MarketplaceItems" (
  "id" SERIAL NOT NULL,
  "seller_id" INT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" NUMERIC(10, 2) NOT NULL,
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
  FOREIGN KEY ("seller_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("item_id") REFERENCES "MarketplaceItems"("id") ON DELETE CASCADE
);

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

-- -------------------------------------------------------------------------------------
--                             Other (for later sprints)
-- -------------------------------------------------------------------------------------

CREATE TABLE "PersonalMessages" (
  "id" SERIAL NOT NULL,
  "sender_id" INT NOT NULL,
  "receiver_id" INT NOT NULL,
  "message" TEXT NOT NULL, 
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE, 
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "PersonalMessages_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("sender_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("receiver_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

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

