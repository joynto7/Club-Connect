import { api } from "./axios";

// ── Types ────────────────────────────────────────────────────────────────────

export type ClubPostAuthor = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ClubPostComment = {
  id: string;
  content: string;
  createdAt: string;
  author: ClubPostAuthor;
};

export type ClubPost = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: ClubPostAuthor;
  myReaction: string | null;
  _count: { comments: number; reactions: number };
};

export type EventQuestion = {
  id: string;
  question: string;
  upvotes: number;
  isAnswered: boolean;
  answer: string | null;
  createdAt: string;
  author: ClubPostAuthor;
  answeredBy: { id: string; name: string } | null;
};

export type FeedItem = {
  type: "NEW_EVENT" | "ANNOUNCEMENT" | "REMINDER" | "NEW_MEMBER";
  id: string;
  title: string;
  subtitle: string;
  link: string;
  createdAt: string;
  image: string | null;
};

export type PublicUser = {
  id: string;
  name: string;
  department: string | null;
  year: string | null;
  interests: string[];
  avatarUrl: string | null;
  memberships: Array<{
    role: string;
    club: { id: string; name: string; slug: string };
  }>;
};

export type PublicUserDetail = PublicUser & {
  createdAt: string;
  memberships: Array<{
    role: string;
    club: { id: string; name: string; slug: string; logoUrl: string | null };
  }>;
  _count: { attendances: number; feedbacks: number };
};

// ── Club Posts API ───────────────────────────────────────────────────────────

export async function listPosts(clubId: string): Promise<ClubPost[]> {
  const { data } = await api.get<ClubPost[]>(`/clubs/${clubId}/posts`);
  return data;
}

export async function listComments(clubId: string, postId: string): Promise<ClubPostComment[]> {
  const { data } = await api.get<ClubPostComment[]>(`/clubs/${clubId}/posts/${postId}/comments`);
  return data;
}

export async function createPost(
  clubId: string,
  payload: { title: string; content: string }
): Promise<ClubPost> {
  const { data } = await api.post<ClubPost>(`/clubs/${clubId}/posts`, payload);
  return data;
}

export async function updatePost(
  clubId: string,
  postId: string,
  payload: { title?: string; content?: string }
): Promise<ClubPost> {
  const { data } = await api.put<ClubPost>(`/clubs/${clubId}/posts/${postId}`, payload);
  return data;
}

export async function deletePost(clubId: string, postId: string): Promise<void> {
  await api.delete(`/clubs/${clubId}/posts/${postId}`);
}

export async function pinPost(clubId: string, postId: string): Promise<ClubPost> {
  const { data } = await api.post<ClubPost>(`/clubs/${clubId}/posts/${postId}/pin`);
  return data;
}

export async function addComment(
  clubId: string,
  postId: string,
  content: string
): Promise<ClubPostComment> {
  const { data } = await api.post<ClubPostComment>(
    `/clubs/${clubId}/posts/${postId}/comments`,
    { content }
  );
  return data;
}

export async function deleteComment(
  clubId: string,
  postId: string,
  commentId: string
): Promise<void> {
  await api.delete(`/clubs/${clubId}/posts/${postId}/comments/${commentId}`);
}

export async function reactToPost(
  clubId: string,
  postId: string,
  emoji: string
): Promise<{ action: string; emoji: string | null }> {
  const { data } = await api.post(`/clubs/${clubId}/posts/${postId}/react`, { emoji });
  return data;
}

// ── Event Q&A API ────────────────────────────────────────────────────────────

export async function listQuestions(eventId: string): Promise<EventQuestion[]> {
  const { data } = await api.get<EventQuestion[]>(`/events/${eventId}/questions`);
  return data;
}

export async function submitQuestion(eventId: string, question: string): Promise<EventQuestion> {
  const { data } = await api.post<EventQuestion>(`/events/${eventId}/questions`, { question });
  return data;
}

export async function upvoteQuestion(eventId: string, qId: string): Promise<{ id: string; upvotes: number }> {
  const { data } = await api.post(`/events/${eventId}/questions/${qId}/upvote`);
  return data;
}

export async function answerQuestion(
  eventId: string,
  qId: string,
  answer: string
): Promise<EventQuestion> {
  const { data } = await api.put<EventQuestion>(
    `/events/${eventId}/questions/${qId}/answer`,
    { answer }
  );
  return data;
}

// ── Follow API ───────────────────────────────────────────────────────────────

export async function followClub(clubId: string): Promise<{ following: boolean; followerCount: number }> {
  const { data } = await api.post(`/clubs/${clubId}/follow`);
  return data;
}

export async function unfollowClub(clubId: string): Promise<{ following: boolean; followerCount: number }> {
  const { data } = await api.delete(`/clubs/${clubId}/follow`);
  return data;
}

// ── Activity Feed API ────────────────────────────────────────────────────────

export async function getFeed(): Promise<FeedItem[]> {
  const { data } = await api.get<FeedItem[]>("/feed");
  return data;
}

// ── User Directory API ───────────────────────────────────────────────────────

export async function listUsers(params?: {
  search?: string;
  department?: string;
  year?: string;
}): Promise<{ users: PublicUser[] }> {
  const { data } = await api.get("/users", { params });
  return data;
}

export async function getUserProfile(userId: string): Promise<{ user: PublicUserDetail }> {
  const { data } = await api.get(`/users/${userId}`);
  return data;
}
