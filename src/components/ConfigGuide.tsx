/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal, ExternalLink, Database, LifeBuoy } from 'lucide-react';
import { dbService, isSupabaseConfigured, isUserConfigured } from '../supabaseClient';

export default function ConfigGuide() {
  const [copied, setCopied] = useState(false);
  const [isRealDb, setIsRealDb] = useState(isSupabaseConfigured);

  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('tfas_custom_supabase_url') || '');
  const [customKey, setCustomKey] = useState(() => localStorage.getItem('tfas_custom_supabase_key') || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'cleared'>('idle');

  useEffect(() => {
    dbService.checkConfig().then((val) => {
      setIsRealDb(val);
    });
  }, []);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim() && customKey.trim()) {
      localStorage.setItem('tfas_custom_supabase_url', customUrl.trim());
      localStorage.setItem('tfas_custom_supabase_key', customKey.trim());
      setSaveStatus('saved');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleClearCredentials = () => {
    localStorage.removeItem('tfas_custom_supabase_url');
    localStorage.removeItem('tfas_custom_supabase_key');
    setCustomUrl('');
    setCustomKey('');
    setSaveStatus('cleared');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const sqlCode = `-- [익명 글쓰기 외래키 원천적 제거 및 즉시 활성화 핫픽스]
-- 아래 코드를 전부 복사하여 Supabase SQL Editor에 넣고 실행(Run)하시면,
-- 기존 데이터 손상 없이 외래키 제약조건만 즉시 제거하여 게시글 등록 실패(foreign key constraint violation)를 완벽히 해결합니다!

-- 1. 기존 테이블에 외래키가 걸려있다면 즉시 제거 (기존 데이터를 완벽히 유지하면서 오류만 즉시 해결하는 방법)
ALTER TABLE IF EXISTS public.tfas_posts DROP CONSTRAINT IF EXISTS tfas_posts_author_id_fkey;
ALTER TABLE IF EXISTS public.tfas_posts DROP CONSTRAINT IF EXISTS tfas_posts_author_id_fkey1;
ALTER TABLE IF EXISTS public.tfas_comments DROP CONSTRAINT IF EXISTS tfas_comments_author_id_fkey;
ALTER TABLE IF EXISTS public.tfas_comments DROP CONSTRAINT IF EXISTS tfas_comments_author_id_fkey1;

-- 2) 모든 테이블 외래키 제약조건 동적 전수 검사 및 강제 제거 블록
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 게시글(tfas_posts) 테이블의 author_id 외래키 제거
    FOR r IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'tfas_posts'
          AND kcu.column_name = 'author_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.tfas_posts DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- 댓글(tfas_comments) 테이블의 author_id 외래키 제거
    FOR r IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'tfas_comments'
          AND kcu.column_name = 'author_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.tfas_comments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- [새로운 설치를 위한 최적화된 테이블 생성 코드]
-- (이미 테이블이 존재하는 경우, 아래 create table은 실행되지 않거나 오류가 나도 무방하며 위 alter/drop 구문이 정상 작동하여 즉시 게시 가능합니다)

-- 1. 사용자 프로필 테이블 생성 (public schema)
create table if not exists public.tfas_profiles (
  id uuid primary key, 
  name text not null,
  bio text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. 게시판 글 테이블 생성 (외래키 제약을 완전히 제거하여 익명/회원 글쓰기 완벽 지원)
create table if not exists public.tfas_posts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  author_id uuid not null, -- (외래키 제약 제거)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  views int default 0 not null,
  password text -- 익명 게시글 수정/삭제용 비밀번호
);

-- 3. 댓글 테이블 생성 (외래키 제약 완전히 제거)
create table if not exists public.tfas_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.tfas_posts(id) on delete cascade not null,
  author_id uuid not null, -- (외래키 제약 제거)
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Row Level Security (RLS) 및 정책 설정
-- (참고: 로그인 없이도 익명 글쓰기가 완벽하게 클라우드에 연동되도록 unauthenticated/anon 생성을 전면 허용한 정책입니다)
alter table public.tfas_profiles enable row level security;
alter table public.tfas_posts enable row level security;
alter table public.tfas_comments enable row level security;

-- 기존 정책 삭제 (중복 생성 오류 방지)
drop policy if exists "누구나 프로필 조회 가능" on public.tfas_profiles;
drop policy if exists "누구나 프로필 생성 가능" on public.tfas_profiles;
drop policy if exists "본인 프로필만 수정 가능" on public.tfas_profiles;

drop policy if exists "누구나 게시글 조회 가능" on public.tfas_posts;
drop policy if exists "누구나 게시글 생성 가능" on public.tfas_posts;
drop policy if exists "본인 게시글만 수정/삭제" on public.tfas_posts;
drop policy if exists "본인 게시글만 삭제" on public.tfas_posts;

drop policy if exists "누구나 댓글 조회 가능" on public.tfas_comments;
drop policy if exists "누구나 댓글 생성 가능" on public.tfas_comments;
drop policy if exists "본인 댓글만 삭제" on public.tfas_comments;

-- 누구나 프로필을 조회하거나 회원 가입 없이 생성을 허용합니다
create policy "누구나 프로필 조회 가능" on public.tfas_profiles
  for select using (true);

create policy "누구나 프로필 생성 가능" on public.tfas_profiles
  for insert with check (true);

create policy "본인 프로필만 수정 가능" on public.tfas_profiles
  for all using (auth.uid() = id);

-- 누구나 게시글을 조회하거나 회원 가입 없이 게시할 수 있도록 허용합니다
create policy "누구나 게시글 조회 가능" on public.tfas_posts
  for select using (true);

create policy "누구나 게시글 생성 가능" on public.tfas_posts
  for insert with check (true);

create policy "본인 게시글만 수정/삭제" on public.tfas_posts
  for update using (auth.uid() = author_id);

create policy "본인 게시글만 삭제" on public.tfas_posts
  for delete using (auth.uid() = author_id);

-- 누구나 댓글을 조회되거나 작성할 수 있도록 허용합니다
create policy "누구나 댓글 조회 가능" on public.tfas_comments
  for select using (true);

create policy "누구나 댓글 생성 가능" on public.tfas_comments
  for insert with check (true);

create policy "본인 댓글만 삭제" on public.tfas_comments
  for delete using (auth.uid() = author_id);

-- [보안 관련 팁] 혹시 RLS 설정으로 인해 권한 에러(insufficient privileges 등)가 발생한다면,
-- 아래 3줄 주석을 풀고 실행하여 RLS 보안 검사를 임시로 비활성화하면 즉시 정상 작동합니다!
-- alter table public.tfas_profiles disable row level security;
-- alter table public.tfas_posts disable row level security;
-- alter table public.tfas_comments disable row level security;
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-brand-card text-brand-text rounded-3xl p-8 shadow-xs border border-brand-border">
      <div className="flex items-center gap-3 border-b border-brand-border/60 pb-5 mb-5">
        <div className="p-2 bg-brand-secondary text-brand-primary rounded-xl border border-brand-border/40">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight font-serif text-brand-text">Supabase 데이터베이스 연동 가이드</h2>
          <p className="text-xs text-brand-muted">실시간 클라우드 DB 연동을 위한 3단계 세팅법</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold text-brand-text flex items-center gap-2 mb-2 font-serif">
            <span className="w-5 h-5 rounded-full bg-brand-secondary text-brand-primary border border-brand-border/40 text-xs flex items-center justify-center font-bold">1</span>
            Supabase 프로젝트 만들기
          </h3>
          <p className="text-xs text-brand-muted-text ml-7 leading-relaxed font-semibold">
            <a 
              href="https://supabase.com" 
              target="_blank" 
              rel="noreferrer" 
              className="text-brand-primary hover:underline inline-flex items-center gap-1 font-bold"
            >
              Supabase 공식 홈페이지 <ExternalLink size={12} />
            </a>
            에 접속하여 새 프로젝트를 무료로 생성하세요.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold text-brand-text flex items-center gap-2 mb-2 font-serif">
            <span className="w-5 h-5 rounded-full bg-brand-secondary text-brand-primary border border-brand-border/40 text-xs flex items-center justify-center font-bold">2</span>
            SQL Editor에 테이블 스크립트 실행하기
          </h3>
          <p className="text-xs text-brand-muted-text ml-7 leading-relaxed mb-3 font-semibold">
            Supabase 대시보드 좌측 메뉴 중 <strong className="text-brand-text font-serif">[SQL Editor]</strong> 탭을 클릭하고, 
            <strong className="text-brand-text font-serif">[New Query]</strong>를 생성한 뒤 아래 코드를 복사하여 실행(<kbd className="bg-brand-secondary border border-brand-border/40 px-1 py-0.5 rounded text-brand-primary font-bold">Run</kbd>)해 주세요.
          </p>

          <div className="relative ml-7 bg-brand-secondary rounded-2xl border border-brand-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-brand-secondary border-b border-brand-border/50">
              <span className="text-xs font-mono text-brand-muted-text flex items-center gap-1.5">
                <Terminal size={14} className="text-brand-muted" />
                schema_setup.sql
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-xs text-brand-muted-text hover:text-brand-primary px-2.5 py-1 rounded-lg bg-brand-card hover:bg-brand-secondary border border-brand-border/40 cursor-pointer transition-colors"
                id="btn-copy-sql"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-600 font-bold">복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span className="font-semibold">코드 복사</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-60 text-brand-text/90 antialiased leading-relaxed scrollbar-thin scrollbar-thumb-brand-border">
              {sqlCode}
            </pre>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-brand-text flex items-center gap-2 mb-2 font-serif">
            <span className="w-5 h-5 rounded-full bg-brand-secondary text-brand-primary border border-brand-border/40 text-xs flex items-center justify-center font-bold">3</span>
            환경변수 설정 및 브라우저 즉시 연동하기 (추천)
          </h3>
          <p className="text-xs text-brand-muted-text ml-7 leading-relaxed font-semibold mb-3">
            Supabase 대시보드의 <strong className="text-brand-text">[Project Settings] → [API]</strong> 메뉴에서 
            <strong className="text-brand-primary">Project URL</strong> 및 <strong className="text-brand-primary">Anon Key</strong>를 복사해 주세요.
            깃허브(GitHub Pages) 배포 상태에서도 코드를 수정하거나 다시 커밋할 필요 없이, 아래에 값을 입력하고 저장하시면 <strong>해당 기기의 브라우저에 즉시 연동</strong>됩니다!
          </p>

          <form onSubmit={handleSaveCredentials} className="ml-7 space-y-3 bg-brand-secondary border border-brand-border/40 rounded-2xl p-4 md:p-5">
            <div className="space-y-1">
              <label className="text-xs font-serif font-bold text-brand-text flex items-center justify-between">
                <span>Supabase Project URL</span>
                <span className="text-[10px] text-brand-muted-text font-mono font-medium">VITE_SUPABASE_URL</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://your-project.supabase.co"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full bg-brand-card border border-brand-border/60 hover:border-brand-primary/50 focus:border-brand-primary px-3 py-2 rounded-xl text-xs font-mono text-brand-text focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-serif font-bold text-brand-text flex items-center justify-between">
                <span>Supabase Anon Key (Public)</span>
                <span className="text-[10px] text-brand-muted-text font-mono font-medium">VITE_SUPABASE_ANON_KEY</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                className="w-full bg-brand-card border border-brand-border/60 hover:border-brand-primary/50 focus:border-brand-primary px-3 py-2 rounded-xl text-xs font-mono text-brand-text focus:outline-none transition-colors resize-none leading-relaxed"
              />
            </div>

            <div className="pt-1 flex flex-wrap gap-2 justify-between items-center">
              <div>
                {saveStatus === 'saved' && (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
                    <Check size={14} /> 브라우저 저장 성공! 잠시 후 자동 새로고침됩니다...
                  </span>
                )}
                {saveStatus === 'cleared' && (
                  <span className="text-xs text-brand-primary font-bold flex items-center gap-1 animate-pulse">
                    초기화 성공! 잠시 후 기본 데모 DB로 복구됩니다...
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {(localStorage.getItem('tfas_custom_supabase_url') || localStorage.getItem('tfas_custom_supabase_key')) && (
                  <button
                    type="button"
                    onClick={handleClearCredentials}
                    className="px-3 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-all cursor-pointer"
                  >
                    연동 초기화
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-brand-secondary font-serif font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  브라우저 즉시 저장 및 연결
                </button>
              </div>
            </div>
          </form>

          <div className="mt-3 ml-7 bg-brand-secondary/40 rounded-xl p-3 border border-brand-border/30 text-[11px] text-brand-muted-text font-semibold leading-relaxed">
            💡 <strong>정석 연동 방법 (모든 방문자 동시 연동):</strong> 깃허브 레포지토리의 <strong className="text-brand-text">[Settings] → [Secrets and variables] → [Actions]</strong> 메뉴에 <code className="text-brand-text font-bold">VITE_SUPABASE_URL</code>와 <code className="text-brand-text font-bold">VITE_SUPABASE_ANON_KEY</code>를 각각 등록해 주시면, 사이트를 방문하는 모든 사용자에게 자동 동기화되는 영구 배포판이 완성됩니다.
          </div>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-brand-border/60 flex items-start gap-2.5 text-xs text-brand-muted-text font-semibold">
        {isUserConfigured ? (
          <>
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0 mt-1.5" />
            <p className="leading-relaxed">
              <strong className="text-brand-text font-serif">현재 상태:</strong> <span className="text-emerald-600 font-bold">개인 Supabase 클라우드 DB 연동 완료!</span> 설정하신 개별 환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)가 완벽하게 수신되어, 본인 소유의 전용 실시간 클라우드 DB에 직접 안전하게 동기화가 이루어지고 있습니다.
            </p>
          </>
        ) : isRealDb ? (
          <>
            <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-pulse shrink-0 mt-1.5" />
            <p className="leading-relaxed">
              <strong className="text-brand-text font-serif">현재 상태:</strong> <span className="text-brand-primary font-bold">공용 실시간 데모 클라우드 DB 연동 중!</span> 아직 맞춤 설정이 활성화되지 않아 기본 공용 클라우드 DB에 동기화가 이루어지고 있습니다. 상단의 단계들을 마쳐 본인의 Supabase 환경변수를 입력하시면 나만의 전용 프라이빗 DB로의 전환이 즉시 완료됩니다!
            </p>
          </>
        ) : (
          <>
            <LifeBuoy size={16} className="text-brand-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-brand-text font-serif">현재 상태:</strong> 환경변수가 아직 설정되지 않았거나 유효하지 않아 안전한 <span className="text-brand-primary font-bold underline">로컬 전용 가상 데이터베이스(LocalStorage)</span>로 활성화되었습니다. 프로필 수정, 게시물 작성 및 회원가입 테스트가 완전하게 실시간 가상으로 지원됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
