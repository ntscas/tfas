/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Post, AuthUser, Category, parseCategoryAndTitle } from '../types';
import { Search, Eye, Calendar, ThumbsUp, RefreshCw, Plus, Menu, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

interface BoardListProps {
  posts: Post[];
  loading: boolean;
  selectedCategory: 'All' | Category;
  selectedPostId?: string;
  currentUser: AuthUser | null;
  onPostClick: (post: Post) => void;
  onWriteClick: () => void;
  fetchPosts: () => Promise<void>;
  onMenuClick?: () => void;
  onLoginClick?: () => void;
  onInstallClick?: () => void;
  onCategorySelect?: (cat: 'All' | Category) => void;
}

export default function BoardList({ 
  posts, 
  loading, 
  selectedCategory, 
  selectedPostId,
  currentUser, 
  onPostClick, 
  onWriteClick,
  fetchPosts,
  onMenuClick,
  onLoginClick,
  onInstallClick,
  onCategorySelect
}: BoardListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'views'>('latest');

  const filteredPosts = posts
    .filter(post => {
      const { category, title: cleanTitle } = parseCategoryAndTitle(post.title);
      
      // Filter by category in sidebar selection
      if (selectedCategory !== 'All' && category !== selectedCategory) {
        return false;
      }

      // Filter by search query
      return (
        cleanTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (sortBy === 'views') {
        return b.views - a.views;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);

      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      if (diffHrs < 24) return `${diffHrs}시간 전`;
      
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    } catch (_) {
      return '알 수 없음';
    }
  };

  const getLikesCount = (postId: string) => {
    const val = localStorage.getItem(`likes_count_${postId}`);
    return val ? parseInt(val, 10) : 0;
  };

  return (
    <div className="flex flex-col h-full bg-brand-card" id="board-list-root">
      
      {/* Mobile Install Promotion Banner */}
      {onInstallClick && (
        <div className="lg:hidden bg-amber-500/10 border-b border-amber-500/15 px-4 py-2.5 flex items-center justify-between text-[11px] font-bold text-amber-600 animate-fade-in shrink-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>독립형 Tax-Forensics 앱을 설치해 보세요!</span>
          </div>
          <button 
            onClick={onInstallClick}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg active:scale-95 text-[10px] font-extrabold shadow-sm cursor-pointer transition-transform"
          >
            앱 설치 ➔
          </button>
        </div>
      )}
      
      {/* Top Search & Actions bar */}
      <div className="p-4 border-b border-brand-border space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Hamburger Menu on Mobile */}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-brand-secondary rounded-xl text-brand-muted-text hover:text-brand-text cursor-pointer transition-colors"
              title="메뉴 열기"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Search input field */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목, 내용 또는 저자명 검색..."
              className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-brand-border rounded-xl text-xs placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all text-brand-text font-medium"
            />
          </div>

          {/* Refresh action */}
          <button 
            onClick={fetchPosts}
            title="새로고침"
            className="p-2 bg-[#f8fafc] hover:bg-brand-hover border border-brand-border rounded-xl text-brand-muted hover:text-brand-text cursor-pointer transition-colors animate-spin-hover shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Login Button next to Write Button for non-logged-in users */}
          {!currentUser && onLoginClick && (
            <button
              onClick={onLoginClick}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all shrink-0"
              title="로그인 / 회원가입"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>로그인</span>
            </button>
          )}

          {/* New Discussion emerald button */}
          <button
            onClick={onWriteClick}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white font-black text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
            id="write-post-btn"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ 글쓰기</span>
          </button>
        </div>
      </div>

      {/* List Sub-header: Filter context and sorting list */}
      <div className="px-3 py-2.5 border-b border-brand-border/60 flex items-center justify-between bg-brand-secondary/35 shrink-0 overflow-hidden">
        {/* Categories Horizontal Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 shrink-0 select-none max-w-[70%]">
          {(['All', '공지', '자유', 'TFAS', '질문'] as const).map((cat) => {
            const isActive = (cat === 'All' && selectedCategory === 'All') || (cat === selectedCategory);
            const displayLabel = cat === 'All' ? 'ALL' : cat;
            return (
              <button
                key={cat}
                onClick={() => onCategorySelect?.(cat)}
                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-brand-primary text-white shadow-xs' 
                    : 'bg-white hover:bg-brand-hover text-brand-muted-text border border-brand-border/60'
                }`}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>
        
        {/* Sort context trigger */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={() => setSortBy(sortBy === 'latest' ? 'views' : 'latest')}
            className="text-[10px] font-extrabold text-brand-muted-text hover:text-brand-text flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{sortBy === 'latest' ? '최신순' : '조회순'}</span>
            <span className="text-[8px]">▼</span>
          </button>
        </div>
      </div>

      {/* Infinite Scrollable Posts Deck */}
      <div className="flex-1 overflow-y-auto divide-y divide-brand-border/55">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-secondary border-t-brand-primary rounded-full animate-spin"></div>
            <p className="text-xs text-brand-muted mt-3 font-semibold">불러오는 중...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-xs text-brand-muted font-bold">일치하는 대화 목록이 없습니다</p>
            <p className="text-[10px] text-brand-muted mt-1">새 Discussion을 생성하여 대화를 시작해보세요!</p>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const { category, title: cleanTitle } = parseCategoryAndTitle(post.title);
            const isSelected = selectedPostId === post.id;
            const isNotice = category === '공지';

            return (
              <div
                key={post.id}
                onClick={() => onPostClick(post)}
                className={`group p-4 transition-all cursor-pointer flex flex-col gap-2 border-l-4 relative ${
                  isSelected 
                    ? 'bg-emerald-50/20 border-emerald-500 shadow-xs' 
                    : isNotice 
                      ? 'bg-red-50/5 hover:bg-brand-hover border-red-500' 
                      : 'border-transparent hover:bg-brand-hover'
                }`}
                id={`post-card-${post.id}`}
              >
                {/* Meta details (top line) */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                    isNotice 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {category}
                  </span>
                  <span className="text-brand-muted font-semibold">{formatDate(post.created_at)}</span>
                </div>

                {/* Post Title */}
                <h3 className="text-xs font-black text-brand-text group-hover:text-brand-primary transition-colors leading-snug line-clamp-1">
                  {cleanTitle}
                </h3>

                {/* Content snippet */}
                <p className="text-[11px] text-brand-muted-text line-clamp-2 leading-relaxed h-[32px]">
                  {post.content}
                </p>

                {/* Footer line (User identity and metrics) */}
                <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-brand-border/20">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-brand-border/50">
                      {post.author_avatar ? (
                        <img 
                          src={post.author_avatar} 
                          alt="avatar" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-brand-secondary text-brand-muted-text font-black text-[9px] flex items-center justify-center">
                          {post.author_name[0]}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-extrabold text-brand-text">{post.author_name}</span>
                  </div>

                  {/* Badges for views & likes */}
                  <div className="flex items-center gap-2.5 text-[10px] text-brand-muted">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{post.views}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-2.5 h-2.5 text-pink-500" />
                      <span>{getLikesCount(post.id)}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
