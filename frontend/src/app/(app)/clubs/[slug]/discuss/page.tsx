"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Pin, PinOff, Trash2, MessageSquare, ThumbsUp, ChevronDown,
  ChevronUp, Plus, ArrowLeft, Send,
} from "lucide-react";
import Link from "next/link";
import {
  listPosts,
  listComments,
  createPost,
  deletePost,
  pinPost,
  addComment,
  deleteComment,
  reactToPost,
  type ClubPost,
} from "@/lib/social";
import { getAuthState } from "@/lib/tokenStorage";
import { getClub } from "@/lib/clubs";
import RichTextEditor from "@/components/shared/RichTextEditor";
import RichTextDisplay from "@/components/shared/RichTextDisplay";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const dim = `w-${size} h-${size}`;
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${dim} rounded-full object-cover ring-2 ring-[#EBA814]/20 flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-[#EBA814] flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
      {initials}
    </div>
  );
}

function CommentsSection({ clubId, postId }: { clubId: string; postId: string }) {
  const qc = useQueryClient();
  const auth = getAuthState();
  const userId = auth?.user?.id;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => listComments(clubId, postId),
  });

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await addComment(clubId, postId, text.trim());
      setText("");
      void qc.invalidateQueries({ queryKey: ["post-comments", postId] });
      void qc.invalidateQueries({ queryKey: ["club-posts", clubId] });
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(clubId, postId, commentId);
      void qc.invalidateQueries({ queryKey: ["post-comments", postId] });
      void qc.invalidateQueries({ queryKey: ["club-posts", clubId] });
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 dark:border-zinc-700 pt-4 space-y-3">
      {isLoading ? (
        <div className="h-12 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse" />
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author.name} url={c.author.avatarUrl} size={7} />
            <div className="flex-1">
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2">
                <span className="font-medium text-sm text-gray-900 dark:text-white">{c.author.name}</span>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{c.content}</p>
              </div>
              <div className="flex items-center gap-3 mt-1 px-1">
                <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                {c.author.id === userId && (
                  <button
                    onClick={() => void handleDelete(c.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {auth && (
        <div className="flex gap-2 mt-2">
          <Avatar name={auth.user.name} url={auth.user.avatarUrl} size={7} />
          <div className="flex-1 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSubmit(); } }}
              placeholder="Write a comment..."
              className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            />
            <button
              onClick={() => void handleSubmit()}
              disabled={!text.trim() || submitting}
              className="px-3 py-2 bg-[#EBA814] text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-[#d4930f] transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  clubId,
  isOfficer,
  onDeleted,
}: {
  post: ClubPost;
  clubId: string;
  isOfficer: boolean;
  onDeleted: (id: string) => void;
}) {
  const qc = useQueryClient();
  const auth = getAuthState();
  const [expanded, setExpanded] = useState(false);
  const [myReaction, setMyReaction] = useState(post.myReaction);
  const [reactCount, setReactCount] = useState(post._count.reactions);

  const handleDelete = async () => {
    try {
      await deletePost(clubId, post.id);
      onDeleted(post.id);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handlePin = async () => {
    try {
      await pinPost(clubId, post.id);
      void qc.invalidateQueries({ queryKey: ["club-posts", clubId] });
    } catch {
      toast.error("Failed to pin post");
    }
  };

  const handleReact = async () => {
    try {
      const result = await reactToPost(clubId, post.id, "👍");
      if (result.action === "removed") {
        setMyReaction(null);
        setReactCount((c) => c - 1);
      } else if (result.action === "added") {
        setMyReaction("👍");
        setReactCount((c) => c + 1);
      }
    } catch {
      toast.error("Failed to react");
    }
  };

  return (
    <motion.div variants={item} className={`bg-white dark:bg-zinc-900 rounded-2xl border ${post.isPinned ? "border-[#EBA814]/40" : "border-gray-200 dark:border-zinc-700"} overflow-hidden`}>
      {post.isPinned && (
        <div className="bg-[#EBA814]/10 px-4 py-1.5 flex items-center gap-1.5 text-xs font-medium text-[#EBA814]">
          <Pin size={12} /> Pinned
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={post.author.name} url={post.author.avatarUrl} />
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{post.author.name}</p>
              <p className="text-xs text-gray-400">{timeAgo(post.createdAt)}</p>
            </div>
          </div>
          {isOfficer && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => void handlePin()}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-[#EBA814] transition-colors"
                title={post.isPinned ? "Unpin" : "Pin"}
              >
                {post.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button
                onClick={() => void handleDelete()}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <h3 className="font-bold text-gray-900 dark:text-white mt-3">{post.title}</h3>
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          <RichTextDisplay html={post.content} />
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
          <button
            onClick={() => void handleReact()}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${myReaction ? "text-[#EBA814]" : "text-gray-500 hover:text-[#EBA814]"}`}
          >
            <ThumbsUp size={15} />
            <span>{reactCount}</span>
          </button>

          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <MessageSquare size={15} />
            <span>{post._count.comments}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CommentsSection clubId={clubId} postId={post.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function DiscussPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const qc = useQueryClient();
  const auth = getAuthState();
  const router = useRouter();

  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // We need the club ID — fetch club data using slug
  const { data: clubData } = useQuery({
    queryKey: ["club", slug],
    queryFn: () => getClub(slug),
  });

  const clubId = clubData?.club.id;
  const myMembership = clubData?.myMembership ?? null;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["club-posts", clubId],
    queryFn: () => listPosts(clubId!),
    enabled: !!clubId,
  });

  const [localPosts, setLocalPosts] = useState<ClubPost[] | null>(null);
  const displayPosts = localPosts ?? posts;

  const handleCreate = async () => {
    if (!clubId || !newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      const post = await createPost(clubId, { title: newTitle.trim(), content: newContent });
      setLocalPosts(null);
      void qc.invalidateQueries({ queryKey: ["club-posts", clubId] });
      setNewTitle("");
      setNewContent("");
      setShowNew(false);
      toast.success("Post created");
    } catch {
      toast.error("Failed to create post");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleted = (id: string) => {
    setLocalPosts((prev) => (prev ?? posts).filter((p) => p.id !== id));
    void qc.invalidateQueries({ queryKey: ["club-posts", clubId] });
  };

  // Determine if current user is an officer of THIS club (not just any club)
  const isOfficer = auth?.user?.role === "UNIVERSITY_ADMIN" ||
    auth?.user?.role === "SYSTEM_ADMIN" ||
    myMembership?.role === "PRESIDENT" ||
    myMembership?.role === "COORDINATOR";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/clubs/${slug}`}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discussion Board</h1>
            <p className="text-sm text-gray-500">{clubData?.club.name}</p>
          </div>
        </div>
        {isOfficer && (
          <button
            onClick={() => setShowNew((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-[#EBA814] text-white rounded-xl text-sm font-medium hover:bg-[#d4930f] transition-colors"
          >
            <Plus size={15} />
            New Post
          </button>
        )}
      </div>

      {/* New Post Form */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 p-5 space-y-4"
          >
            <h2 className="font-bold text-gray-900 dark:text-white">Create Post</h2>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Post title..."
              className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            />
            <RichTextEditor value={newContent} onChange={setNewContent} placeholder="What do you want to share with your club?" />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={!newTitle.trim() || !newContent.trim() || creating}
                className="px-4 py-2 bg-[#EBA814] text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-[#d4930f] transition-colors"
              >
                {creating ? "Posting..." : "Post"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 p-5 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded" />
                  <div className="h-3 w-16 bg-gray-100 dark:bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="h-5 w-48 bg-gray-200 dark:bg-zinc-700 rounded mb-2" />
              <div className="h-12 bg-gray-100 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : displayPosts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No posts yet</p>
          <p className="text-sm mt-1">
            {isOfficer ? "Start the conversation with a new post." : "Officers can start a discussion here."}
          </p>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {displayPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              clubId={clubId!}
              isOfficer={isOfficer}
              onDeleted={handleDeleted}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
