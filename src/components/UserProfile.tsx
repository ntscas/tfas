/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile as ProfileType, AuthUser, Post, Comment } from '../types';
import { dbService, isSupabaseConfigured } from '../supabaseClient';
import { Save, User, BookOpen, ImageIcon, Sparkles, Check, FileText, MessageSquare, Lock } from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfileProps {
  currentUser: AuthUser;
  onProfileUpdated?: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200'
];

export default function UserProfile({ currentUser, onProfileUpdated }: UserProfileProps) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Stats
  const [userPostsCount, setUserPostsCount] = useState(0);
  const [isRealDb, setIsRealDb] = useState(isSupabaseConfigured);

  useEffect(() => {
    dbService.checkConfig().then((val) => {
      setIsRealDb(val);
    });
    loadProfileAndStats();
  }, [currentUser.id]);

  const loadProfileAndStats = async () => {
    setIsLoading(true);
    try {
      const profile = await dbService.getProfile(currentUser.id);
      if (profile) {
        setName(profile.name || currentUser.name || '');
        setBio(profile.bio || '');
        setAvatarUrl(profile.avatar_url || '');
      } else {
        setName(currentUser.name || '');
      }

      // Load all posts to count this user's contributions
      const allPosts = await dbService.getPosts();
      const userPosts = allPosts.filter(p => p.author_id === currentUser.id);
      setUserPostsCount(userPosts.length);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('이름 또는 닉네임을 설정해 주세요.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const result = await dbService.updateProfile(currentUser.id, {
        name: name.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim()
      });

      if (result.success) {
        setSuccessMsg('프로필이 성공적으로 업데이트되었습니다! ✨');
        if (onProfileUpdated) {
          onProfileUpdated();
        }
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(result.error || '프로필 수정에 실패했습니다.');
      }
    } catch (err: any) {
      setErrorMsg('저장 중 예상치 못한 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-brand-card rounded-3xl border border-brand-border">
        <div className="w-10 h-10 border-3 border-brand-secondary border-t-brand-primary rounded-full animate-spin"></div>
        <p className="text-sm text-brand-muted mt-4 font-semibold">프로필 수집 중...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="user-profile-container">
      
      {/* Left Bento: Visual Summary Card */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-brand-card rounded-3xl border border-brand-border p-6 shadow-xs text-center space-y-4">
          <div className="relative inline-block mx-auto group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand-border shadow-md">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-brand-secondary text-brand-muted-text flex items-center justify-center font-bold text-xl">
                  {name ? name[0] : currentUser.email[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-brand-primary text-brand-card rounded-full p-1.5 shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div>
            <h3 className="font-bold text-brand-text text-lg leading-tight font-serif">{name || '아직 이름이 없습니다'}</h3>
            <p className="text-[11px] text-brand-muted font-mono mt-1 font-semibold">{currentUser.email}</p>
          </div>

          {bio && (
            <p className="text-xs text-brand-muted-text italic bg-brand-secondary p-3 rounded-2xl border border-brand-border/40 leading-relaxed text-center">
              "{bio}"
            </p>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 border-t border-brand-border/60 pt-4">
            <div className="flex items-center justify-center gap-2">
              <div className="bg-brand-secondary text-brand-primary p-2 rounded-xl border border-brand-border/50">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-brand-muted text-[10px] uppercase font-bold">작성한 글</div>
                <div className="text-brand-text font-bold text-sm tracking-tight">{userPostsCount} 개</div>
              </div>
            </div>
          </div>
        </div>

        {/* 로그인 및 계정 보안 정보 */}
        <div className="bg-brand-card rounded-3xl border border-brand-border p-5 shadow-xs space-y-4 text-left">
          <div className="flex items-center gap-2 border-b border-brand-border/60 pb-3">
            <Lock className="w-4 h-4 text-brand-primary" />
            <h4 className="text-xs font-black text-brand-text uppercase tracking-wider">로그인 및 계정 보안 정보</h4>
          </div>
          
          <div className="space-y-3.5 text-xs text-brand-muted-text">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[10px] text-brand-muted uppercase">사용자 이메일</span>
              <span className="font-mono font-bold text-brand-text truncate max-w-[150px]" title={currentUser.email}>
                {currentUser.email}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[10px] text-brand-muted uppercase">인증 데이터베이스</span>
              <span className="font-mono text-[10px] font-bold text-brand-primary">
                {isRealDb ? 'Supabase cloud' : 'LocalStorage cache'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[10px] text-brand-muted uppercase">계정 보안 패스워드</span>
              <span className="font-mono text-[9px] font-bold text-brand-muted-text">•••••••• (암호화 서명됨)</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[10px] text-brand-muted uppercase">가입 상태 및 권한</span>
              <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px]">
                {isRealDb ? '실시간 연동 완료' : '임시 가상 회원'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[10px] text-brand-muted uppercase">전문가 인증 레벨</span>
              <span className="font-bold text-brand-text">조세 일반 전문가 (Cert)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Bento: Settings Form */}
      <div className="lg:col-span-2">
        <form onSubmit={handleUpdate} className="bg-brand-card rounded-3xl border border-brand-border p-8 shadow-xs space-y-6">
          <div className="border-b border-brand-border/60 pb-4">
            <h2 className="text-lg font-bold text-brand-text tracking-tight font-serif">프로필 정보 편집</h2>
            <p className="text-xs text-brand-muted mt-1">게시판에서 보이는 고유한 아바타 및 회원 정보를 커스터마이징합니다.</p>
          </div>

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-100 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-50 text-red-655 text-xs font-semibold rounded-xl border border-red-100">
               {errorMsg}
            </div>
          )}

          {/* Preset avatar select */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-brand-text">추천 프로필 이미지 선택</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESET_AVATARS.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={`relative w-12 h-12 rounded-full overflow-hidden border-2 cursor-pointer transition-all ${avatarUrl === preset ? 'border-brand-primary scale-105 ring-2 ring-brand-secondary ring-offset-1' : 'border-brand-border opacity-60 hover:opacity-100'}`}
                >
                  <img src={preset} alt={`preset ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          </div>

          {/* Custom Avatar URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-text">프로필 이미지 URL</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-brand-muted">
                <ImageIcon className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... 나 외부 이미지 URL 주소를 직접 입력해 보세요"
                className="w-full pl-10 pr-4 py-2.5 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
              />
            </div>
          </div>

          {/* Profile Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-text font-serif">이름 또는 닉네임 *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-brand-muted">
                <User className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full pl-10 pr-4 py-2.5 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
              />
            </div>
          </div>

          {/* Profile Bio Input (자기소개) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-text font-serif">자기소개</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-brand-muted">
                <BookOpen className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="자신을 자유롭게 소개해 주세요"
                className="w-full pl-10 pr-4 py-2.5 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
              />
            </div>
          </div>

          {/* Submit Profile edits */}
          <div className="flex items-center justify-end pt-4 border-t border-brand-border/60">
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-brand-secondary disabled:text-brand-muted text-brand-card font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
              id="profile-save-btn"
            >
              <Save className="w-4 h-4 text-brand-card" />
              <span>{isSaving ? '업데이트중...' : '프로필 저장하기'}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
