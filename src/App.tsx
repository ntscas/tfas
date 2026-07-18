/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthUser, Post, Category, parseCategoryAndTitle } from './types';
import { dbService, isSupabaseConfigured } from './supabaseClient';
import BoardList from './components/BoardList';
import PostDetail from './components/PostDetail';
import PostForm from './components/PostForm';
import { 
  Cloud, 
  CloudOff, 
  Layers, 
  Sparkles, 
  Rss, 
  Zap,
  BarChart3,
  Bookmark,
  BookOpen,
  Eye,
  Heart,
  ChevronRight,
  Menu,
  X,
  Download,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const currentUser = null; // 로그인 기능 제거 (익명 전용)
  const [boardView, setBoardView] = useState<'list' | 'detail' | 'write' | 'edit'>('list');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [editPassword, setEditPassword] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  // Check if already running as standalone PWA
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsInIframe(window.self !== window.top);
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      console.log('[PWA] Standalone 모드 감지:', isStandaloneMode, '아이프레임 여부:', window.self !== window.top);
      
      // Parse shortcut actions on startup
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'write') {
        setBoardView('write');
      } else if (action === 'board') {
        setBoardView('list');
      }
    }
  }, []);

  // listen for browser PWA triggers
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt 이벤트를 수신했습니다. 설치 가능 상태.');
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      console.log('[PWA] Tax-Forensics 앱이 성공적으로 설치되었습니다.');
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] 사용자 선택 결과: ${outcome}`);
      setDeferredPrompt(null);
    }
  };

  // High fidelity states
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | Category>('All');
  const [likesUpdateTrigger, setLikesUpdateTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch posts globally to compute stats and categories counts
  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const dbPosts = await dbService.getPosts();
      setPosts(dbPosts);
      
      // Auto-select first post on initial load if on desktop and none selected
      if (dbPosts.length > 0 && !selectedPost) {
        setSelectedPost(dbPosts[0]);
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
          setBoardView('detail');
        } else {
          setBoardView('list');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [likesUpdateTrigger]);

  // Statistics calculation
  const totalPosts = posts.length;
  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const totalLikes = posts.reduce((sum, p) => {
    const val = localStorage.getItem(`likes_count_${p.id}`);
    return sum + (val ? parseInt(val, 10) : 0);
  }, 0);

  // Categories counts calculation
  const getCategoryCount = (cat: 'All' | Category) => {
    if (cat === 'All') return posts.length;
    return posts.filter(p => parseCategoryAndTitle(p.title).category === cat).length;
  };

  // Switch category
  const handleCategorySelect = (cat: 'All' | Category) => {
    setSelectedCategory(cat);
    setMobileMenuOpen(false);
    
    // Auto preview first post in this selected category on desktop
    const filtered = cat === 'All' 
      ? posts 
      : posts.filter(p => parseCategoryAndTitle(p.title).category === cat);
      
    if (filtered.length > 0) {
      setSelectedPost(filtered[0]);
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setBoardView('detail');
      } else {
        setBoardView('list');
      }
    } else {
      setSelectedPost(null);
      setBoardView('list');
    }
  };

  return (
    <div className="h-screen w-screen bg-brand-bg text-brand-text flex overflow-hidden font-sans" id="app-root">
      
      {/* 1. Sidebar Column (Left) - Hidden on Mobile, Collapsible */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-brand-sidebar-bg border-r border-[#1e293b] flex flex-col justify-between p-6 transition-transform duration-300 transform lg:translate-x-0 lg:static lg:flex shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-8">
          {/* Logo Brand Icon Block */}
          <div className="flex items-center justify-between">
            <div 
              onClick={() => handleCategorySelect('All')}
              className="flex items-center gap-3 cursor-pointer"
              id="brand-logo"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
                <ShieldCheck className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-emerald-400 tracking-tight leading-tight">Tax-Forensics</span>
                <h1 className="text-base font-extrabold text-white tracking-tight leading-none">TFAS</h1>
              </div>
            </div>

            {/* Mobile close sidebar */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="block lg:hidden text-brand-sidebar-muted hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Category list */}
          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-brand-sidebar-muted font-extrabold uppercase tracking-widest pl-2 mb-3">
                Navigation (카테고리)
              </p>
              <nav className="space-y-1">
                {(['All', '공지', '자유', 'TFAS', '질문'] as const).map((cat) => {
                  const isActive = selectedCategory === cat;
                  const label = cat === 'All' ? 'All Discussions' : cat;
                  const count = getCategoryCount(cat);
                  const isNotice = cat === '공지';

                  return (
                    <button
                      key={cat}
                      onClick={() => handleCategorySelect(cat)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-brand-primary text-white shadow-md' 
                          : 'text-slate-300 hover:bg-brand-sidebar-hover hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${isNotice ? 'bg-red-500' : 'bg-brand-primary'}`} />
                        <span>{label}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isActive 
                          ? 'bg-white/25 text-white' 
                          : isNotice 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Utility links */}
            <div>
              <p className="text-[10px] text-brand-sidebar-muted font-extrabold uppercase tracking-widest pl-2 mb-3">
                Database Status
              </p>
              <nav className="space-y-1.5">
                {isSupabaseConfigured ? (
                  <div
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-300 bg-emerald-500/5 border border-emerald-500/10"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>클라우드 DB: 연결됨</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  </div>
                ) : (
                  <div
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-300 bg-rose-500/5 border border-rose-500/10"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-rose-400" />
                      <span>클라우드 DB: 미설정</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                  </div>
                )}

                {/* App Installation Option */}
                {isStandalone ? (
                  <div
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-slate-400 bg-slate-800/20 border border-slate-800/40"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>TFAS 앱 설치 완료됨</span>
                    </span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-md font-extrabold">Active</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (deferredPrompt) {
                        handleInstallApp();
                      } else {
                        setShowInstallModal(true);
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-amber-300 bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-200 cursor-pointer text-left active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-amber-400 animate-bounce" style={{ animationDuration: '2s' }} />
                      <span>TFAS 앱 설치하기</span>
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md font-extrabold animate-pulse">설치</span>
                  </button>
                )}
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom Bento Box Stats */}
        <div className="space-y-4 pt-6 border-t border-[#1e293b]">
          <div>
            <p className="text-[10px] text-brand-sidebar-muted font-extrabold uppercase tracking-widest pl-2 mb-2.5">
              Database Stat
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#1e293b]/40 border border-[#2e3c54]/40 p-2 rounded-2xl">
                <p className="text-[9px] text-brand-sidebar-muted font-extrabold uppercase">Posts</p>
                <p className="text-xs font-black text-white mt-0.5">{totalPosts}</p>
              </div>
              <div className="bg-[#1e293b]/40 border border-[#2e3c54]/40 p-2 rounded-2xl">
                <p className="text-[9px] text-brand-sidebar-muted font-extrabold uppercase">Views</p>
                <p className="text-xs font-black text-emerald-400 mt-0.5">{totalViews}</p>
              </div>
              <div className="bg-[#1e293b]/40 border border-[#2e3c54]/40 p-2 rounded-2xl">
                <p className="text-[9px] text-brand-sidebar-muted font-extrabold uppercase">Likes</p>
                <p className="text-xs font-black text-pink-400 mt-0.5">{totalLikes}</p>
              </div>
            </div>
          </div>

          {/* Secure Anonymous tip box */}
          <div className="bg-[#1e293b]/50 p-3.5 rounded-2xl border border-[#2e3c54]/30 space-y-1.5">
            <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <span>🔒 100% 안전한 익명 광장</span>
            </p>
            <p className="text-[10px] text-brand-sidebar-muted leading-relaxed font-semibold">
              TFAS는 별도의 가입이나 로그인이 불필요합니다. 글 작성 시 입력한 비밀번호를 통해 자유롭고 안전하게 게시글을 수정 및 삭제할 수 있습니다.
            </p>
          </div>
        </div>
      </aside>

      {/* App Core Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Mobile Header - Hidden when viewing the BoardList list view on mobile */}
        {boardView !== 'list' && (
          <header className="lg:hidden h-14 shrink-0 bg-brand-card border-b border-brand-border px-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 text-brand-text hover:bg-brand-secondary rounded-lg"
              >
                <Menu className="w-5.5 h-5.5" />
              </button>
              <span className="text-sm font-extrabold text-brand-text font-serif">TFAS</span>
            </div>
          </header>
        )}

        {/* 2 & 3. Split Desktop Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Column 2: list items. 
              Always show on desktop. On mobile, show when boardView is list. */}
          <section 
            className={`w-full lg:w-[380px] shrink-0 border-r border-brand-border bg-brand-card flex flex-col h-full overflow-hidden ${
              boardView === 'list' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <BoardList 
              posts={posts}
              loading={postsLoading}
              selectedCategory={selectedCategory}
              selectedPostId={selectedPost?.id}
              currentUser={null}
              onWriteClick={() => {
                setBoardView('write');
              }}
              onPostClick={(post) => {
                setSelectedPost(post);
                setBoardView('detail');
              }}
              fetchPosts={fetchPosts}
              onMenuClick={() => setMobileMenuOpen(true)}
              onInstallClick={!isStandalone ? () => {
                if (deferredPrompt) {
                  handleInstallApp();
                } else {
                  setShowInstallModal(true);
                }
              } : undefined}
              onCategorySelect={handleCategorySelect}
            />
          </section>

          {/* Column 3: Active Detail/Form view panel.
              Always show on desktop. On mobile, show when view is not list. */}
          <main 
            className={`flex-1 h-full bg-[#f3f5f8] overflow-y-auto pt-0 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 relative ${
              boardView === 'list' ? 'hidden lg:block' : 'block'
            }`}
          >


            <AnimatePresence mode="wait">
              <motion.div
                key={`${boardView}-${selectedPost?.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto h-full"
              >
                {boardView === 'detail' && selectedPost ? (
                  <PostDetail 
                    post={selectedPost}
                    currentUser={null}
                    onBack={() => {
                      setBoardView('list');
                    }}
                    onEdit={(post, pwd) => {
                      setPostToEdit(post);
                      setEditPassword(pwd || '');
                      setBoardView('edit');
                    }}
                    onDeleted={() => {
                      setSelectedPost(null);
                      setBoardView('list');
                      fetchPosts();
                    }}
                    onLikeUpdated={() => setLikesUpdateTrigger(prev => prev + 1)}
                  />
                ) : boardView === 'write' ? (
                  <PostForm 
                    currentUser={null}
                    onSuccess={() => {
                      setBoardView('list');
                      fetchPosts();
                    }}
                    onCancel={() => setBoardView('list')}
                  />
                ) : boardView === 'edit' && postToEdit ? (
                  <PostForm 
                    postToEdit={postToEdit}
                    editPassword={editPassword}
                    currentUser={null}
                    onSuccess={() => {
                      setBoardView('list');
                      setEditPassword('');
                      fetchPosts();
                    }}
                    onCancel={() => {
                      setBoardView('list');
                      setEditPassword('');
                    }}
                  />
                ) : (
                  /* Empty list state template on board */
                  <div className="pt-4 md:pt-6 lg:pt-8 h-full">
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-brand-card rounded-3xl border border-brand-border shadow-xs">
                      <Bookmark className="w-12 h-12 text-brand-muted/70 mb-4 animate-bounce" />
                      <h2 className="text-lg font-bold text-brand-text font-serif">열람할 내용이 없습니다</h2>
                      <p className="text-xs text-brand-muted mt-1.5 max-w-xs mx-auto">
                        좌측 목록에서 포스팅을 하나 클릭하시거나 새 이야기를 게시해 보세요!
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* TFAS PWA Install Guidance Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs" id="install-guide-backdrop">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl relative space-y-4.5 text-slate-800"
            >
              <button 
                onClick={() => setShowInstallModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                id="btn-close-modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <Download className="w-5 h-5 text-emerald-500 animate-bounce" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-serif">TFAS 앱 설치하기</h3>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  독립형 앱(PWA)으로 설치해 보세요! 일반 모바일 앱처럼 홈화면에서 원터치로 빠르게 접속할 수 있습니다.
                </p>
              </div>

              {/* Special Context 1: Preview Iframe detected */}
              {isInIframe && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-2 text-center">
                  <p className="text-[10px] text-amber-700 font-extrabold leading-relaxed">
                    ⚠️ 현재 AI Studio 실시간 편집 프리뷰(아이프레임) 내부에서는 모바일 브라우저 보안 정책상 다이렉트 설치가 막혀있을 수 있습니다.
                  </p>
                  <button
                    onClick={() => window.open(window.location.origin, '_blank')}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-[10px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>새 창(전체 화면)으로 열기 ➔</span>
                  </button>
                  <p className="text-[9px] text-slate-400 font-bold">
                    ※ 새 창에서 열면 즉시 원클릭 설치 버튼이 정상 작동합니다!
                  </p>
                </div>
              )}

              {/* Special Context 2: One-click Browser prompt is available */}
              {deferredPrompt && (
                <div className="p-1">
                  <button
                    onClick={() => {
                      handleInstallApp();
                      setShowInstallModal(false);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center shadow-md flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Download className="w-4 h-4 animate-bounce" />
                    <span>지금 기기에 즉시 설치하기</span>
                  </button>
                </div>
              )}

              {/* iOS vs Android Guide Tabs */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50 space-y-3">
                {typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-rose-500 pb-1.5 border-b border-slate-100">
                      <span>📱 아이폰/아이패드 (iOS Safari) 설치 방법</span>
                    </div>
                    <ol className="text-[11px] text-slate-600 space-y-2.5 list-decimal list-inside font-semibold leading-relaxed">
                      <li>
                        Safari 브라우저 하단 툴바의 <span className="font-bold text-emerald-600">[공유]</span> 아이콘(네모와 위 화살표 아이콘)을 선택합니다.
                      </li>
                      <li>
                        목록에서 아래로 조금 스크롤하여 <span className="font-bold text-slate-950 bg-slate-200/60 p-0.5 px-1.5 rounded">[홈 화면에 추가]</span> 메뉴를 클릭합니다.
                      </li>
                      <li>
                        우측 상단의 <span className="font-bold text-slate-950">[추가]</span> 버튼을 터치하여 설치를 완료합니다!
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-600 pb-1.5 border-b border-slate-100">
                      <span>📱 안드로이드 / 모바일 크롬 설치 방법</span>
                    </div>
                    <ol className="text-[11px] text-slate-600 space-y-2.5 list-decimal list-inside font-semibold leading-relaxed">
                      <li>
                        모바일 크롬 주소창 오른쪽의 <span className="font-bold text-slate-950 bg-slate-200/60 p-0.5 px-1.5 rounded">[점 3개]</span>를 누르고 <span className="font-bold text-emerald-600">[앱 설치]</span> 또는 <span className="font-bold text-slate-950 bg-slate-200/60 p-0.5 px-1.5 rounded">[홈 화면에 추가]</span>를 터치합니다.
                      </li>
                      <li>
                        또는, 이 가이드 상단의 <span className="text-emerald-600 font-extrabold">[원클릭 즉시 설치]</span> 버튼이 보일 시 클릭 한 번으로 손쉽게 추가할 수 있습니다!
                      </li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-xl active:scale-[0.98] transition-all cursor-pointer text-center"
                >
                  가이드 닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Passive Connection status is handled via sidebar indicator */}
      </AnimatePresence>

    </div>
  );
}
