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

  useEffect(() => {
    dbService.checkConfig().then((val) => {
      setIsRealDb(val);
    });
  }, []);

  const sqlCode = `-- [기존 DB 외래키 제약조건 제거 핫픽스 - 익명/비회원 실시간 글쓰기 오류 완벽 방지]
-- 이 스크립트는 tax_profiles 테이블의 어떠한 외래키(auth.users 연동 등)도 자동으로 찾아내 삭제하는 무결성 핫픽스입니다.
-- 아래 SQL을 복사하여 Supabase SQL Editor에서 실행하시면 즉시 익명 클라우드 저장이 영구 가동됩니다!
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'tax_profiles'
          AND kcu.column_name = 'id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.tax_profiles DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- (선택 사항: 만약 위 구문이 생소하다면 아래 기존 1줄 명령도 동일한 역할을 시도합니다)
-- ALTER TABLE public.tax_profiles DROP CONSTRAINT IF EXISTS tax_profiles_id_fkey;

-- 1. 사용자 프로필 테이블 생성 (public schema)
create table public.tax_profiles (
  id uuid primary key, -- (익명 및 비회원 글쓰기 완벽 호환을 위해 auth.users 직접 외래키 제약조건제외)
  name text not null,
  bio text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. 게시판 글 테이블 생성
create table public.tax_posts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  author_id uuid references public.tax_profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  views int default 0 not null
);

-- 3. 댓글 테이블 생성
create table public.tax_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.tax_posts(id) on delete cascade not null,
  author_id uuid references public.tax_profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Row Level Security (RLS) 및 정책 설정
-- (참고: 로그인 없이도 익명 글쓰기가 완벽하게 클라우드에 연동되도록 unauthenticated/anon 생성을 전면 허용한 정책입니다)
alter table public.tax_profiles enable row level security;
alter table public.tax_posts enable row level security;
alter table public.tax_comments enable row level security;

-- 누구나 프로필을 조회하거나 회원 가입 없이 생성을 허용합니다
create policy "누구나 프로필 조회 가능" on public.tax_profiles
  for select using (true);

create policy "누구나 프로필 생성 가능" on public.tax_profiles
  for insert with check (true);

create policy "본인 프로필만 수정 가능" on public.tax_profiles
  for all using (auth.uid() = id);

-- 누구나 게시글을 조회하거나 회원 가입 없이 게시할 수 있도록 허용합니다
create policy "누구나 게시글 조회 가능" on public.tax_posts
  for select using (true);

create policy "누구나 게시글 생성 가능" on public.tax_posts
  for insert with check (true);

create policy "본인 게시글만 수정/삭제" on public.tax_posts
  for update using (auth.uid() = author_id);

create policy "본인 게시글만 삭제" on public.tax_posts
  for delete using (auth.uid() = author_id);

-- 누구나 댓글을 조회되거나 작성할 수 있도록 허용합니다
create policy "누구나 댓글 조회 가능" on public.tax_comments
  for select using (true);

create policy "누구나 댓글 생성 가능" on public.tax_comments
  for insert with check (true);

create policy "본인 댓글만 삭제" on public.tax_comments
  for delete using (auth.uid() = author_id);

-- [초단기 해결 팁] 만약 위의 복잡한 RLS 보안 설정을 수동 제어하고 싶지 않으시다면,
-- 아래 3문장을 실행해 RLS 자체를 가볍게 꺼주시면 즉시 클라우드에 비회원 무제한 글쓰기가 가동됩니다!
-- alter table public.tax_profiles disable row level security;
-- alter table public.tax_posts disable row level security;
-- alter table public.tax_comments disable row level security;
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
            환경변수 설정하기 (마지막 단계)
          </h3>
          <p className="text-xs text-brand-muted-text ml-7 leading-relaxed font-semibold">
            Supabase 대시보드의 <strong className="text-brand-text">[Project Settings] → [API]</strong> 메뉴에서 
            <strong className="text-brand-primary">Project URL</strong> 및 <strong className="text-brand-primary">Anon Key</strong>를 찾은 뒤, 
            이 App 내부의 Secrets 설정이나 <code className="text-brand-text">.env</code> 파일에 다음 값으로 입력해 주시면 연동이 완료됩니다!
          </p>
          <div className="mt-2.5 ml-7 bg-brand-secondary rounded-xl p-4 border border-brand-border/40 font-mono text-xs text-brand-primary font-bold space-y-1">
            <div>VITE_SUPABASE_URL = "복사한 Project URL 주소"</div>
            <div>VITE_SUPABASE_ANON_KEY = "복사한 anon public key 값"</div>
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
