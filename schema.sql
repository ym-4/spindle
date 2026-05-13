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
  "avatar" TEXT,
  "hashed_password" TEXT NOT NULL DEFAULT 'placeholder', 
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

CREATE TABLE "PostReactions" (
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

CREATE TABLE "Groups" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "creator_id" INT NOT NULL,
  "description" TEXT NOT NULL, 
  "school" TEXT NOT NULL, 
  "module" TEXT NOT NULL, 
  CONSTRAINT "Groups_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("creator_id") REFERENCES "Person"("id") ON DELETE CASCADE
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
  CONSTRAINT "GroupDiscussions_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("group_id") REFERENCES "Groups"("id") ON DELETE CASCADE
);

-- -------------------------------------------------------------------------------------
--                                  OTHERS
-- -------------------------------------------------------------------------------------

CREATE TABLE "ChatroomMessages" (
  "id" SERIAL NOT NULL,
  "user_id" INT NOT NULL,
  "message" TEXT NOT NULL,
  CONSTRAINT "ChatroomMessages_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "MarketplaceItems" (
  "id" SERIAL NOT NULL,
  "seller_id" INT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" NUMERIC(10, 2) NOT NULL,
  CONSTRAINT "MarketplaceItems_pkey" PRIMARY KEY ("id"), 
  FOREIGN KEY ("seller_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "UserFriends" (
  "user_id" INT NOT NULL,
  "friend_id" INT NOT NULL,
  CONSTRAINT "UserFriends_pkey" PRIMARY KEY ("user_id", "friend_id"),
  FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE, 
  FOREIGN KEY ("friend_id") REFERENCES "Person"("id") ON DELETE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
CREATE UNIQUE INDEX "Person_name_key" ON "Person"("name");


