/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Post, Comment, AuthUser, parseCategoryAndTitle } from '../types';
import { dbService } from '../supabaseClient';
import { ChevronLeft, Trash2, Edit3, Send, Calendar, Eye, MessageSquare, AlertCircle, Heart, X, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PostDetailProps {
  post: Post;
  onBack: () => void;
  onEdit: (post: Post, password?: string) => void;
  currentUser: AuthUser | null;
  onDeleted: () => void;
  onLikeUpdated?: () => void;
}

export default function PostDetail({ post, onBack, onEdit, currentUser, onDeleted, onLikeUpdated }: PostDetailProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentNickname, setCommentNickname] = useState('익명');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [views, setViews] = useState(post.views);
  const [hasPassword, setHasPassword] = useState(false);

  // Password verification modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'edit' | 'delete' | null>(null);
  const [inputPassword, setInputPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);

  const [likes, setLikes] = useState(() => {
    const val = localStorage.getItem(`likes_count_${post.id}`);
    return val ? parseInt(val, 10) : 0;
  });

  const { category, title: cleanTitle } = parseCategoryAndTitle(post.title);

  useEffect(() => {
    // Increment view count on load & fetch comments & check password
    const handleInit = async () => {
      await dbService.incrementViews(post.id);
      setViews(prev => prev + 1);
      fetchComments();
      dbService.hasPostPassword(post.id).then(setHasPassword);
    };
    handleInit();
  }, [post.id]);

  const fetchComments = async () => {
    try {
      const dbComments = await dbService.getComments(post.id);
      setComments(dbComments);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePostDelete = async (passwordInput?: string) => {
    if (!passwordInput && !window.confirm('정말로 이 글을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      const result = await dbService.deletePost(post.id, passwordInput);
      if (result.success) {
        onDeleted();
      } else {
        alert(result.error || '게시글 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = () => {
    if (isAuthor) {
      onEdit(post);
    } else if (hasPassword) {
      setPasswordAction('edit');
      setShowPasswordModal(true);
      setPasswordError('');
      setInputPassword('');
    }
  };

  const handleDeleteClick = () => {
    if (isAuthor && !hasPassword) {
      handlePostDelete();
    } else if (hasPassword) {
      setPasswordAction('delete');
      setShowPasswordModal(true);
      setPasswordError('');
      setInputPassword('');
    } else {
      handlePostDelete();
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword.trim()) return;

    setIsCheckingPassword(true);
    setPasswordError('');

    try {
      const isValid = await dbService.verifyPostPassword(post.id, inputPassword.trim());
      if (isValid) {
        setShowPasswordModal(false);
        if (passwordAction === 'edit') {
          onEdit(post, inputPassword.trim());
        } else if (passwordAction === 'delete') {
          const result = await dbService.deletePost(post.id, inputPassword.trim());
          if (result.success) {
            onDeleted();
          } else {
            setPasswordError(result.error || '삭제 중 오류가 발생했습니다.');
          }
        }
      } else {
        setPasswordError('비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      setPasswordError('인증 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingPassword(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      let result;
      if (currentUser) {
        result = await dbService.createComment(post.id, commentText.trim(), currentUser.id);
      } else {
        result = await dbService.createAnonymousComment(post.id, commentText.trim(), commentNickname.trim() || '익명');
      }

      if (result.success && result.data) {
        setCommentText('');
        fetchComments();
      } else {
        alert(result.error || '댓글 등록에 실패했습니다.');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      const result = await dbService.deleteComment(commentId);
      if (result.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      } else {
        alert(result.error || '댓글 삭제에 실패했습니다.');
      }
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (_) {
      return '';
    }
  };

  const handleLike = () => {
    const nextLikes = likes + 1;
    setLikes(nextLikes);
    localStorage.setItem(`likes_count_${post.id}`, nextLikes.toString());
    onLikeUpdated?.();
  };

  const isAuthor = (currentUser && currentUser.id === post.author_id) || dbService.getMyAnonAuthorIds().includes(post.author_id);

  return (
    <div className="space-y-4" id={`post-detail-${post.id}`}>
      
      {/* Navigation Header */}
      <div className="sticky top-0 z-20 bg-[#f3f5f8] py-3 mb-4 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 border-b border-brand-border/40 flex items-center justify-between">
        <button
          onClick={onBack}
          className="lg:hidden flex items-center gap-1 text-xs font-semibold text-brand-text hover:text-brand-primary transition-colors bg-brand-card px-2.5 py-1.5 rounded-xl border border-brand-border shadow-xs cursor-pointer"
          id="btn-back-to-list"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>목록으로</span>
        </button>
        <div className="hidden lg:block text-xs font-semibold text-brand-muted-text">
          게시글 상세보기
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {(isAuthor || hasPassword) && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleEditClick}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-secondary hover:bg-brand-hover text-brand-text font-semibold text-xs rounded-xl border border-brand-border cursor-pointer transition-colors"
                id="btn-edit-post"
              >
                <Edit3 className="w-3 relative -top-[0.5px] text-brand-primary" />
                <span>수정</span>
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100/80 text-red-700 font-semibold text-xs rounded-xl border border-red-100 cursor-pointer transition-colors"
                id="btn-delete-post"
              >
                <Trash2 className="w-3" />
                <span>{isDeleting ? '삭제중' : '삭제'}</span>
              </button>
            </div>
          )}

          <button
            onClick={onBack}
            className="flex items-center justify-center p-1.5 bg-brand-card hover:bg-brand-secondary text-brand-text rounded-xl border border-brand-border cursor-pointer transition-colors shadow-xs"
            id="btn-close-x"
            title="목록으로"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Post Card */}
      <div className="bg-brand-card rounded-3xl border border-brand-border p-8 shadow-xs space-y-6">
        
        {/* Post Metadata Header */}
        <div className="border-b border-brand-border/60 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg ${
              category === '공지'
                ? 'bg-red-100 text-red-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}>
              {category}
            </span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold text-brand-text tracking-tight leading-snug mb-4 font-serif">
            {cleanTitle}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-border">
                {post.author_avatar ? (
                  <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-brand-secondary text-brand-muted-text font-bold text-xs flex items-center justify-center">
                    {post.author_name[0]}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-brand-text">{post.author_name}</div>
                <div className="text-[11px] text-brand-muted font-semibold flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-muted/70" />
                  <span>{formatDate(post.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-brand-muted-text bg-brand-secondary px-3 py-1.5 rounded-lg border border-brand-border/40">
              <Eye className="w-4 h-4 text-brand-muted" />
              <span>조회수 {views}</span>
            </div>
          </div>
        </div>

        {/* Post Body Content */}
        <div className="text-brand-text text-sm whitespace-pre-line leading-relaxed min-h-[120px] pr-2">
          {post.content}
        </div>

        {/* Recommendation Trigger Button */}
        <div className="flex justify-center pt-8 border-t border-brand-border/40 mt-8">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 px-6 py-2.5 bg-pink-50 hover:bg-pink-100/80 text-pink-600 border border-pink-100 rounded-full font-extrabold text-xs transition-all active:scale-95 cursor-pointer hover:shadow-xs"
            id="like-post-btn"
          >
            <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
            <span>이 글 추천하기 ({likes})</span>
          </button>
        </div>
      </div>

      {/* Comment Section Container */}
      <div className="bg-brand-card rounded-3xl border border-brand-border p-8 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-brand-text flex items-center gap-2 mb-4 font-serif">
          <MessageSquare className="w-5 h-5 text-brand-primary" />
          <span>댓글</span>
          <span className="bg-brand-secondary text-brand-primary px-2.5 py-0.5 rounded-full text-xs font-bold border border-brand-border/60">{comments.length}</span>
        </h2>

        {/* Comment input form */}
        <form onSubmit={handleCommentSubmit} className="space-y-3.5">
          {!currentUser && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-brand-muted-text">작성자 닉네임 (익명):</span>
              <input
                type="text"
                value={commentNickname}
                onChange={(e) => setCommentNickname(e.target.value)}
                placeholder="익명"
                className="px-3 py-1.5 bg-brand-input border border-brand-border rounded-lg text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          )}
          <div className="relative">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글 내용을 따뜻하고 건설적으로 작성해 주세요."
              rows={3}
              className="w-full p-4 bg-brand-input border border-brand-border rounded-2xl text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all resize-none leading-relaxed"
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !commentText.trim()}
              className="absolute bottom-3.5 right-3.5 flex items-center gap-1.5 px-3.5 py-2 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-brand-secondary disabled:text-brand-muted text-brand-card font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              id="comment-submit-btn"
            >
              <Send className="w-3 h-3" />
              <span>등록</span>
            </button>
          </div>
        </form>

        {/* Comment Listing */}
        <div className="mt-6 space-y-4 pt-4 border-t border-brand-border/60">
          {comments.length === 0 ? (
            <p className="text-xs text-brand-muted py-4 text-center font-medium">아직 등록된 댓글이 없습니다. 첫 마디를 건네보세요!</p>
          ) : (
            <div className="divide-y divide-brand-border/40 space-y-4">
              {comments.map((comment, index) => (
                <div key={comment.id} className="pt-4 first:pt-0 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-border shrink-0 mt-0.5">
                      {comment.author_avatar ? (
                        <img src={comment.author_avatar} alt={comment.author_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-brand-secondary text-brand-muted-text font-bold text-[10px] flex items-center justify-center">
                          {comment.author_name[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-brand-text">{comment.author_name}</span>
                        <span className="text-[10px] text-brand-muted font-medium">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-xs text-brand-muted-text mt-1 leading-relaxed whitespace-pre-line">{comment.content}</p>
                    </div>
                  </div>

                  {((currentUser && currentUser.id === comment.author_id) || dbService.getMyAnonAuthorIds().includes(comment.author_id)) && (
                    <button
                      onClick={() => handleCommentDelete(comment.id)}
                      className="p-1 px-2.5 text-[11px] text-brand-muted hover:text-red-700 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 font-bold cursor-pointer"
                      id={`delete-comment-${comment.id}`}
                    >
                      제거
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Closed Action Row */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-card hover:bg-brand-secondary text-brand-text font-bold text-xs rounded-xl border border-brand-border cursor-pointer shadow-xs transition-transform active:scale-[0.98]"
          id="btn-close-bottom"
        >
          <span>닫기</span>
        </button>
      </div>

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl relative space-y-4 text-slate-800"
            >
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                id="btn-close-pwd-modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-serif">게시글 권한 인증</h3>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  이 글을 {passwordAction === 'edit' ? '수정' : '삭제'}하기 위해 등록하신 비밀번호를 입력해 주세요.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 text-[11px] font-bold rounded-xl border border-red-100 text-center">
                    {passwordError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <input
                    type="password"
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    required
                    autoFocus
                    disabled={isCheckingPassword}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-semibold text-center"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={isCheckingPassword}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl active:scale-[0.98] transition-all cursor-pointer text-center"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isCheckingPassword || !inputPassword.trim()}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-xl active:scale-[0.98] transition-all cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>{isCheckingPassword ? '확인 중...' : '확인'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
