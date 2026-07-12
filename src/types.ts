/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Category = '공지' | '자유' | '카통' | '질문';

export function parseCategoryAndTitle(title: string): { category: Category; title: string } {
  const match = title.match(/^\[(공지|자유|정보|카통|질문)\]\s*(.*)$/);
  if (match) {
    let cat = match[1];
    if (cat === '정보') cat = '카통';
    return {
      category: cat as Category,
      title: match[2].trim()
    };
  }
  // Fallbacks based on common words or defaults
  if (title.includes('공지') || title.includes('오픈하였습니다')) {
    return { category: '공지', title: title.trim() };
  }
  return { category: '자유', title: title.trim() };
}

export function buildTitleWithCategory(category: Category, title: string): string {
  // Prevent duplicate prefixes if editing
  const cleaned = title.replace(/^\[(공지|자유|정보|카통|질문)\]\s*/, '');
  return `[${category}] ${cleaned.trim()}`;
}

export interface UserProfile {
  id: string;
  name: string;
  bio: string;
  avatar_url: string;
  updated_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
  views: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface DatabaseState {
  profiles: Record<string, UserProfile>;
  posts: Post[];
  comments: Comment[];
  currentUser: AuthUser | null;
}
