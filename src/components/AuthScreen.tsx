import React, { useState } from 'react';
import { dbService } from '../supabaseClient';
import { Mail, Lock, User, Sparkles, Check, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onSuccess: (user: any) => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { user, error: signUpErr } = await dbService.signUp(email, password, name);
        if (signUpErr) throw signUpErr;
        setSuccessMsg('회원가입이 완료되었습니다! 자동 로그인 중...');
        setTimeout(() => {
          if (user) onSuccess(user);
        }, 1500);
      } else {
        const { user, error: signInErr } = await dbService.signIn(email, password);
        if (signInErr) throw signInErr;
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || '인증에 실패했습니다. 입력값을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 max-w-md mx-auto shadow-sm">
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-slate-900 font-serif">
          {isSignUp ? '1초 간편 회원가입' : '이메일 로그인'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {isSignUp ? '간단한 정보만 입력하고 바로 활동해 보세요!' : '가입하신 계정 정보로 로그인해 주세요.'}
        </p>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 font-medium">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 flex items-center gap-2 font-bold animate-pulse">
          <Check size={14} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        {isSignUp && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">이름 또는 닉네임</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 focus:border-brand-primary focus:bg-white pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none transition-all"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">이메일 주소</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-brand-primary focus:bg-white pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">비밀번호</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              minLength={6}
              placeholder="6자리 이상 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-brand-primary focus:bg-white pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {loading ? (
            <span>처리 중...</span>
          ) : (
            <>
              <Sparkles size={14} />
              <span>{isSignUp ? '회원가입 완료하기' : '로그인하기'}</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
          className="text-xs text-brand-primary hover:underline font-bold cursor-pointer"
        >
          {isSignUp ? '이미 계정이 있으신가요? 로그인하기' : '아직 계정이 없으신가요? 간편 회원가입'}
        </button>
      </div>
    </div>
  );
}
