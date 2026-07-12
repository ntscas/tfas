import { createClient } from '@supabase/supabase-js';
import { Post, Comment, UserProfile, AuthUser } from './types';

function cleanEnvValue(val: string | undefined): string {
  if (!val) return '';
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned.trim();
}

function cleanSupabaseUrl(url: string): string {
  if (!url) return '';
  const cleaned = cleanEnvValue(url);
  if (cleaned.includes('supabase.com/dashboard/project/')) {
    const parts = cleaned.split('supabase.com/dashboard/project/');
    if (parts.length > 1) {
      const ref = parts[1].split('/')[0].trim();
      if (ref) return `https://${ref}.supabase.co`;
    }
  }
  return cleaned;
}

// Read credentials directly from environment variables (.env file)
const envUrl = cleanSupabaseUrl((import.meta as any).env.VITE_SUPABASE_URL || '');
const envAnonKey = cleanEnvValue((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '');

export const supabaseUrl = envUrl;
export const supabaseAnonKey = envAnonKey;

export const isUserConfigured = !!envUrl && !!envAnonKey;
export const isSupabaseConfigured = isUserConfigured;

// Instantiating the real client-side Supabase client if configured
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const TABLES = {
  profiles: 'tfas_profiles',
  posts: 'tfas_posts',
  comments: 'tfas_comments'
};

let hasDetectedTables = false;
export async function ensureTablesDetected() {
  if (hasDetectedTables) return;
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('tfas_posts').select('id').limit(1);
      if (error && (error.message?.includes('does not exist') || error.code === '42P01' || error.message?.includes('not found'))) {
        console.log('[Supabase] tfas_posts table not found. Falling back to tax_posts table.');
        TABLES.profiles = 'tax_profiles';
        TABLES.posts = 'tax_posts';
        TABLES.comments = 'tax_comments';
      } else {
        console.log('[Supabase] Using tfas_posts / tfas_profiles / tfas_comments tables.');
      }
    } catch (e) {
      console.warn('[Supabase] Error detecting tables:', e);
    }
  }
  hasDetectedTables = true;
}

// Trigger detection on module load
ensureTablesDetected();

if (isUserConfigured) {
  console.log('[Supabase] 사용자 클라우드 실시간 데이터베이스 연동 성공! URL:', supabaseUrl);
} else {
  console.warn('[Supabase] 경고: VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY 환경 변수가 .env에 설정되지 않았습니다.');
}

// Helper to implement queries with timeout to handle sleeping free-tier database instantly
function withTimeout(promise: any, timeoutMs = 4000): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('TIMEOUT_EXCEEDED'));
    }, timeoutMs);
    
    Promise.resolve(promise).then(
      (res: any) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err: any) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function getClientDeviceUUID(): string {
  let id = localStorage.getItem('supabase_anon_device_uuid');
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem('supabase_anon_device_uuid', id);
  }
  return id;
}

async function getOrCreateAnonUserSession(): Promise<string> {
  if (!supabase) throw new Error('Supabase client is not configured. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  
  try {
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (!authError && authData?.user) {
      return authData.user.id;
    }
  } catch (e) {
    console.warn('[Supabase] Native anonymous login failed, trying session fallback:', e);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return session.user.id;
    }
  } catch (_) {}

  return getClientDeviceUUID();
}

export const dbService = {
  async checkConfig(): Promise<boolean> {
    return isSupabaseConfigured;
  },

  getMyAnonAuthorIds(): string[] {
    try {
      const val = localStorage.getItem('my_anon_author_ids');
      return val ? JSON.parse(val) : [];
    } catch (_) {
      return [];
    }
  },

  registerMyAnonAuthorId(id: string) {
    try {
      const ids = this.getMyAnonAuthorIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem('my_anon_author_ids', JSON.stringify(ids));
      }
    } catch (_) {}
  },

  subscribeAuth(callback: (user: AuthUser | null) => void) {
    if (isSupabaseConfigured && supabase) {
      this.getCurrentUser().then(callback);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const user = session.user;
          let name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
          try {
            await ensureTablesDetected();
            const { data: p } = await withTimeout(
              supabase.from(TABLES.profiles).select('name').eq('id', user.id).single(),
              1500
            );
            if (p?.name) name = p.name;
          } catch (_) {}
          callback({
            id: user.id,
            email: user.email || '',
            name
          });
        } else {
          callback(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      callback(null);
      return () => {};
    }
  },

  async signUp(email: string, password: string, name: string, bio: string = '', avatarUrl: string = '') {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다. .env 파일을 작성해주세요.' };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('회원가입에 실패했습니다.');

      const userId = data.user.id;

      await ensureTablesDetected();
      const { error: profileError } = await supabase
        .from(TABLES.profiles)
        .upsert({
          id: userId,
          name: name,
          bio: bio || '',
          avatar_url: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.warn('Profile automatic creation failed:', profileError.message);
      }

      const authUser: AuthUser = {
        id: userId,
        email: data.user.email || '',
        name: name
      };

      return { success: true, user: authUser };
    } catch (err: any) {
      console.error('SignUp Error:', err);
      return { success: false, error: err.message || '회원가입 중 오류가 발생했습니다.' };
    }
  },

  async signIn(email: string, password: string) {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다. .env 파일을 작성해주세요.' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (!data.user) throw new Error('로그인에 실패했습니다.');

      let name = data.user.user_metadata?.full_name || email.split('@')[0];
      try {
        await ensureTablesDetected();
        const { data: profile } = await supabase
          .from(TABLES.profiles)
          .select('name')
          .eq('id', data.user.id)
          .single();
        if (profile && profile.name) {
          name = profile.name;
        }
      } catch (_) {}

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
        name: name
      };

      return { success: true, user: authUser };
    } catch (err: any) {
      console.error('Login Error:', err);
      return { success: false, error: err.message || '이메일 또는 비밀번호가 올바르지 않습니다.' };
    }
  },

  async signOut() {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error during Supabase signout:', e);
      }
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data: { user }, error } = await withTimeout(supabase.auth.getUser(), 2500);
      if (error || !user) return null;

      let name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      try {
        await ensureTablesDetected();
        const { data: p } = await withTimeout(
          supabase.from(TABLES.profiles).select('name').eq('id', user.id).single(),
          1500
        );
        if (p?.name) name = p.name;
      } catch (_) {}

      return {
        id: user.id,
        email: user.email || '',
        name
      };
    } catch (e) {
      return null;
    }
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      await ensureTablesDetected();
      const { data, error } = await withTimeout(
        supabase
          .from(TABLES.profiles)
          .select('*')
          .eq('id', userId)
          .single(),
        2500
      );

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            id: userId,
            name: '사용자',
            bio: '',
            avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`,
            updated_at: new Date().toISOString()
          };
        }
        throw error;
      }
      return data as UserProfile;
    } catch (err) {
      console.error('Fetch profile error:', err);
      return null;
    }
  },

  async updateProfile(userId: string, profileData: Partial<UserProfile>) {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    try {
      await ensureTablesDetected();
      const { error } = await supabase
        .from(TABLES.profiles)
        .upsert({
          id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Update profile error:', err);
      return { success: false, error: err.message };
    }
  },

  async getPosts(): Promise<Post[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      await ensureTablesDetected();
      const { data: rawPosts, error: postError } = await withTimeout(
        supabase
          .from(TABLES.posts)
          .select('id, title, content, author_id, created_at, views')
          .order('created_at', { ascending: false }),
        4000
      );

      if (postError) throw postError;

      const postsData = rawPosts || [];
      const authorIds = Array.from(new Set(postsData.map((p: any) => p.author_id).filter(Boolean)));

      let profilesMap: Record<string, { name: string; avatar_url: string }> = {};
      if (authorIds.length > 0) {
        const { data: rawProfiles, error: profileError } = await withTimeout(
          supabase
            .from(TABLES.profiles)
            .select('id, name, avatar_url')
            .in('id', authorIds),
          2500
        );

        if (!profileError && rawProfiles) {
          rawProfiles.forEach((prof: any) => {
            profilesMap[prof.id] = {
              name: prof.name || '알 수 없음',
              avatar_url: prof.avatar_url || ''
            };
          });
        }
      }

      const posts = postsData.map((item: any) => {
        const profile = profilesMap[item.author_id];
        return {
          id: item.id,
          title: item.title,
          content: item.content,
          author_id: item.author_id,
          author_name: profile?.name || '알 수 없음',
          author_avatar: profile?.avatar_url || '',
          created_at: item.created_at,
          views: item.views || 0
        };
      });

      posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return posts;
    } catch (err) {
      console.error('Fetch posts error:', err);
      return [];
    }
  },

  async incrementViews(postId: string) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await ensureTablesDetected();
      const { data: post } = await supabase.from(TABLES.posts).select('views').eq('id', postId).single();
      if (post) {
        await supabase.from(TABLES.posts).update({ views: (post.views || 0) + 1 }).eq('id', postId);
      }
    } catch (e) {
      console.warn('Increment views error:', e);
    }
  },

  async createPost(title: string, content: string, userId: string, password?: string): Promise<{ success: boolean; data?: Post; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    try {
      await ensureTablesDetected();
      const { data, error } = await supabase
        .from(TABLES.posts)
        .insert({
          title,
          content,
          author_id: userId,
          created_at: new Date().toISOString(),
          views: 0,
          password: password || null
        })
        .select()
        .single();

      if (error) throw error;

      const { data: profile } = await supabase
        .from(TABLES.profiles)
        .select('name, avatar_url')
        .eq('id', userId)
        .single();

      const newPost: Post = {
        id: data.id,
        title: data.title,
        content: data.content,
        author_id: data.author_id,
        author_name: profile?.name || '알 수 없음',
        author_avatar: profile?.avatar_url || '',
        created_at: data.created_at,
        views: 0,
        password: data.password || undefined
      };

      return { success: true, data: newPost };
    } catch (err: any) {
      console.error('Create post error:', err);
      return { success: false, error: err.message };
    }
  },

  async verifyPostPassword(postId: string, passwordInput: string): Promise<boolean> {
    if (!passwordInput || !isSupabaseConfigured || !supabase) return false;
    try {
      await ensureTablesDetected();
      const { data } = await supabase
        .from(TABLES.posts)
        .select('id')
        .eq('id', postId)
        .eq('password', passwordInput)
        .maybeSingle();
      return !!data;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async hasPostPassword(postId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      await ensureTablesDetected();
      const { data } = await supabase
        .from(TABLES.posts)
        .select('password')
        .eq('id', postId)
        .single();
      return !!(data && data.password);
    } catch (e) {
      return false;
    }
  },

  async updatePost(id: string, title: string, content: string, passwordInput?: string) {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    try {
      await ensureTablesDetected();
      if (passwordInput) {
        const isValid = await this.verifyPostPassword(id, passwordInput);
        if (!isValid) {
          return { success: false, error: '비밀번호가 일치하지 않습니다.' };
        }
      }

      const { error } = await supabase
        .from(TABLES.posts)
        .update({ title, content })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Update post error:', err);
      return { success: false, error: err.message };
    }
  },

  async deletePost(id: string, passwordInput?: string) {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    try {
      await ensureTablesDetected();
      if (passwordInput) {
        const isValid = await this.verifyPostPassword(id, passwordInput);
        if (!isValid) {
          return { success: false, error: '비밀번호가 일치하지 않습니다.' };
        }
      }

      await supabase
        .from(TABLES.comments)
        .delete()
        .eq('post_id', id);

      const { error } = await supabase
        .from(TABLES.posts)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Delete post error:', err);
      return { success: false, error: err.message };
    }
  },

  async getComments(postId: string): Promise<Comment[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      await ensureTablesDetected();
      const { data: rawComments, error: commentError } = await withTimeout(
        supabase
          .from(TABLES.comments)
          .select('id, post_id, author_id, content, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: true }),
        3000
      );

      if (commentError) throw commentError;

      const commentsData = rawComments || [];
      const authorIds = Array.from(new Set(commentsData.map((c: any) => c.author_id).filter(Boolean)));

      let profilesMap: Record<string, { name: string; avatar_url: string }> = {};
      if (authorIds.length > 0) {
        const { data: rawProfiles, error: profileError } = await withTimeout(
          supabase
            .from(TABLES.profiles)
            .select('id, name, avatar_url')
            .in('id', authorIds),
          2000
        );

        if (!profileError && rawProfiles) {
          rawProfiles.forEach((prof: any) => {
            profilesMap[prof.id] = {
              name: prof.name || '알 수 없음',
              avatar_url: prof.avatar_url || ''
            };
          });
        }
      }

      const comments = commentsData.map((item: any) => {
        const profile = profilesMap[item.author_id];
        return {
          id: item.id,
          post_id: item.post_id,
          author_id: item.author_id,
          author_name: profile?.name || '알 수 없음',
          author_avatar: profile?.avatar_url || '',
          content: item.content,
          created_at: item.created_at
        };
      });

      comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return comments;
    } catch (err) {
      console.error('Fetch comments error:', err);
      return [];
    }
  },

  async createComment(postId: string, content: string, userId: string): Promise<{ success: boolean; data?: Comment; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    try {
      await ensureTablesDetected();
      const { data, error } = await supabase
        .from(TABLES.comments)
        .insert({
          post_id: postId,
          content,
          author_id: userId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const { data: profile } = await supabase
        .from(TABLES.profiles)
        .select('name, avatar_url')
        .eq('id', userId)
        .single();

      const newComment: Comment = {
        id: data.id,
        post_id: data.post_id,
        author_id: data.author_id,
        author_name: profile?.name || '알 수 없음',
        author_avatar: profile?.avatar_url || '',
        content: data.content,
        created_at: data.created_at
      };

      return { success: true, data: newComment };
    } catch (err: any) {
      console.error('Create comment error:', err);
      return { success: false, error: err.message };
    }
  },

  async createAnonymousPost(title: string, content: string, nickname: string, password?: string): Promise<{ success: boolean; data?: Post; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    let finalNickname = nickname.trim() || '익명';
    let userId = '';
    try {
      userId = await getOrCreateAnonUserSession();
    } catch (authErr: any) {
      console.warn('[Supabase] Anonymous session fetch failed:', authErr);
      userId = getClientDeviceUUID();
    }

    try {
      await ensureTablesDetected();
      const { error: profileError } = await supabase
        .from(TABLES.profiles)
        .upsert({
          id: userId,
          name: finalNickname,
          bio: '익명으로 작성된 본 질문/답변 프로필입니다.',
          avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalNickname)}`,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        throw new Error(`사용자 프로필 테이블(${TABLES.profiles}) 등록 실패: ${profileError.message}`);
      }

      this.registerMyAnonAuthorId(userId);

      const result = await this.createPost(title, content, userId, password);
      if (result.success) {
        return result;
      } else {
        throw new Error(result.error || `게시글 테이블(${TABLES.posts}) 저장 실패`);
      }
    } catch (dbErr: any) {
      console.error('Cloud raw insert failed:', dbErr);
      const errorMsg = dbErr?.message || '데이터베이스 연결 및 저장에 실패했습니다.';
      return { success: false, error: errorMsg };
    }
  },

  async createAnonymousComment(postId: string, content: string, nickname: string): Promise<{ success: boolean; data?: Comment; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    let finalNickname = nickname.trim() || '익명';
    let userId = '';
    try {
      userId = await getOrCreateAnonUserSession();
    } catch (authErr: any) {
      console.warn('[Supabase] Anonymous auth failed for comment:', authErr);
      userId = getClientDeviceUUID();
    }

    try {
      await ensureTablesDetected();
      const { error: profileError } = await supabase
        .from(TABLES.profiles)
        .upsert({
          id: userId,
          name: finalNickname,
          bio: '익명 사용자',
          avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalNickname)}`,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        throw new Error(`사용자 프로필 테이블(${TABLES.profiles}) 등록 실패: ${profileError.message}`);
      }

      this.registerMyAnonAuthorId(userId);

      const result = await this.createComment(postId, content, userId);
      if (result.success) {
        return result;
      } else {
        throw new Error(result.error || `댓글 테이블(${TABLES.comments}) 저장 실패`);
      }
    } catch (dbErr: any) {
      console.error('Cloud raw comment insert failed:', dbErr);
      const errorMsg = dbErr?.message || '데이터베이스 연결 및 댓글 저장에 실패했습니다.';
      return { success: false, error: errorMsg };
    }
  },

  async deleteComment(id: string) {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase가 설정되지 않았습니다.' };
    }
    try {
      await ensureTablesDetected();
      const { error } = await supabase
        .from(TABLES.comments)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Delete comment error:', err);
      return { success: false, error: err.message };
    }
  }
};
