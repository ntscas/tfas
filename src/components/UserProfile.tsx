import React, { useState, useEffect } from 'react';
import { dbService } from '../supabaseClient';
import { UserProfile as UserProfileType } from '../types';
import { User, Image, Check, AlertCircle } from 'lucide-react';

interface UserProfileProps {
  currentUser: { id: string; email?: string; name?: string };
  onProfileUpdated?: () => void;
}

export default function UserProfile({ currentUser, onProfileUpdated }: UserProfileProps) {
  const [name, setName] = useState(currentUser.name || '');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    dbService.getProfile(currentUser.id).then((profile) => {
      if (profile) {
        setName(profile.name || '');
        setAvatarUrl(profile.avatar_url || '');
      }
    });
  }, [currentUser.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await dbService.updateProfile(currentUser.id, {
        name,
        avatar_url: avatarUrl,
      });
      setMessage('프로필 정보가 성공적으로 업데이트되었습니다.');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setError(err.message || '업데이트 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 max-w-md mx-auto shadow-sm">
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-slate-900 font-serif">내 프로필 설정</h3>
        <p className="text-xs text-slate-500 mt-1">계정 정보 및 닉네임을 설정합니다.</p>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 font-medium">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 flex items-center gap-2 font-bold animate-pulse">
          <Check size={14} />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">이메일 계정 (수정 불가)</label>
          <input
            type="text"
            disabled
            value={currentUser.email || ''}
            className="w-full bg-slate-100 border border-slate-200 pl-4 pr-4 py-2.5 rounded-xl text-xs focus:outline-none text-slate-500 cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">닉네임 / 필명</label>
          <div className="relative">
            <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              placeholder="표시할 이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-brand-primary focus:bg-white pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">아바타 이미지 URL (선택)</label>
          <div className="relative">
            <Image size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              placeholder="https://example.com/image.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-brand-primary focus:bg-white pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer"
        >
          {loading ? '변경 중...' : '프로필 저장하기'}
        </button>
      </form>
    </div>
  );
}
