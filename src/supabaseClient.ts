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
  // If the user entered the browser dashboard URL by mistake
  if (cleaned.includes('supabase.com/dashboard/project/')) {
    const parts = cleaned.split('supabase.com/dashboard/project/');
    if (parts.length > 1) {
      const ref = parts[1].split('/')[0].trim();
      if (ref) return `https://${ref}.supabase.co`;
    }
  }
  return cleaned;
}

// Read custom database credentials from environment if configured, otherwise use the default demo DB
const envUrl = cleanSupabaseUrl((import.meta as any).env.VITE_SUPABASE_URL);
const envAnonKey = cleanEnvValue((import.meta as any).env.VITE_SUPABASE_ANON_KEY);

const defaultUrl = 'https://yvxjcsoiqekjkckcluql.supabase.co';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2eGpjc29pcWVramtja2NsdXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzUxOTAsImV4cCI6MjA5NjA1MTE5MH0.NG6tg3HAN7ZfW-sr8ogIu1sjvCj80k7WpckR0bePwec';

export const supabaseUrl = envUrl || defaultUrl;
export const supabaseAnonKey = envAnonKey || defaultAnonKey;

export const isUserConfigured = !!envUrl && !!envAnonKey;
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Instantiating the real client-side Supabase client directly
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (isUserConfigured) {
  console.log('[Supabase] 사용자 사용자 정의 클라우드 실시간 데이터베이스 연동 성공! URL:', supabaseUrl);
} else {
  console.log('[Supabase] 기본 데모 클라우드 실시간 데이터베이스 연동 성공! URL:', supabaseUrl);
}

// Helper to implement queries with timeout to handle sleeping free-tier database instantly
function withTimeout(promise: any, timeoutMs = 2800): Promise<any> {
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

// Helper to manage LocalStorage database fallback
const LOCAL_STORAGE_KEY = 'supabase_board_fallback_db';

interface LocalDB {
  users: Record<string, { email: string; name: string; passwordHash: string }>;
  profiles: Record<string, UserProfile>;
  posts: Post[];
  comments: Comment[];
  currentUser: AuthUser | null;
}

const initialLocalDB: LocalDB = {
  users: {
    'demo-user-id': {
      email: 'demo@example.com',
      name: '김테스트',
      passwordHash: 'demo123'
    }
  },
  profiles: {
    'demo-user-id': {
      id: 'demo-user-id',
      name: '김테스트',
      bio: '안녕하세요! 이 게시판의 첫 번째 데모 사용자입니다. Supabase를 연동하여 실시간 데이터베이스를 구축해보세요.',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      updated_at: new Date().toISOString()
    }
  },
  posts: [
    {
      id: 'demo-post-1',
      title: 'Supabase 연동 게시판에 오신 것을 환영합니다!',
      content: '이 게시판은 Supabase 와 연동되어 동작하도록 개발되었습니다.\n\n현재는 안전한 오프라인 LocalStorage 데모 모드로 작동 중입니다. .env.example 파일을 참고하여 VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY 환경 변수를 등록하시면 즉시 실제 Supabase의 실시간 클라우드 DB와 연동됩니다.\n\n프로필 페이지에서 나만의 아바타, 자기소개 및 이름을 변경하고 글을 작성해 보세요!',
      author_id: 'demo-user-id',
      author_name: '김테스트',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
      views: 42
    },
    {
      id: 'demo-post-2',
      title: 'Supabase 테이블 설정을 위한 SQL 쿼리 가이드 (꿀팁)',
      content: '실제 Supabase를 사용하실 때 대시보드의 SQL Editor에 실행할 쿼리문입니다.\n\n화면 상단의 [DB 연동 가이드] 버튼을 누르시면 필요한 전체 SQL 스크립트를 즉시 복사하여 편리하게 데이터베이스를 구축하실 수 있습니다.',
      author_id: 'demo-user-id',
      author_name: '김테스트',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      views: 9
    }
  ],
  comments: [
    {
      id: 'demo-comment-1',
      post_id: 'demo-post-1',
      author_id: 'demo-user-id',
      author_name: '김테스트',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      content: '너무 깔끔하고 예쁜 게시판이네요! 🚀',
      created_at: new Date(Date.now() - 1800000).toISOString()
    }
  ],
  currentUser: null
};

function getLocalDB(): LocalDB {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialLocalDB));
    return initialLocalDB;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return initialLocalDB;
  }
}

function saveLocalDB(db: LocalDB) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
}

// Global active auth listener for local fallback
let authListeners: ((user: AuthUser | null) => void)[] = [];

async function getOrCreateAnonUserSession(): Promise<string> {
  if (!supabase) throw new Error('Supabase client is not instantiated');
  
  // 1) Try native anonymous sign in first
  try {
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (!authError && authData?.user) {
      return authData.user.id;
    }
  } catch (e) {
    console.warn('[Supabase] Native anonymous login failed, trying persistent custom account fallback:', e);
  }

  // 2) Fallback: Check for existing session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return session.user.id;
    }
  } catch (_) {}

  // 3) Create a unique email-based dummy user for this device.
  // This satisfies BOTH auth.users AND tax_posts_author_id_fkey database foreign keys completely!
  const deviceId = getClientDeviceUUID();
  const cleanId = deviceId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toLowerCase();
  const dummyEmail = `user_${cleanId}@taxtalk_fallback.com`;
  const dummyPass = `Pass123_!#${cleanId.substring(0, 8)}`;

  try {
    // Attempt sign in with password
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: dummyEmail,
      password: dummyPass
    });

    if (!signInErr && signInData?.user) {
      return signInData.user.id;
    }

    // If sign in fails, attempt registration
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: dummyEmail,
      password: dummyPass,
      options: {
        data: {
          name: '익명'
        }
      }
    });

    if (!signUpErr && signUpData?.user) {
      return signUpData.user.id;
    }

    // Last resort session check
    const { data: { session: lastSession } } = await supabase.auth.getSession();
    if (lastSession?.user) {
      return lastSession.user.id;
    }
  } catch (fallbackErr) {
    console.error('[Supabase] Custom account fallback error:', fallbackErr);
  }

  // Safe fallback to raw device UUID
  return deviceId;
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
      // 1. Initial user check
      this.getCurrentUser().then(callback);

      // 2. Auth state change listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const user = session.user;
          let name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
          try {
            const { data: p } = await withTimeout(
              supabase.from('tax_profiles').select('name').eq('id', user.id).single(),
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
      authListeners.push(callback);
      // Initial fetch
      this.getCurrentUser().then(callback);
      
      // Return unsubscribe function
      return () => {
        authListeners = authListeners.filter(l => l !== callback);
      };
    }
  },

  notifyAuthChange(user: AuthUser | null) {
    authListeners.forEach(l => l(user));
  },

  async signUp(email: string, password: string, name: string, bio: string = '', avatarUrl: string = '') {
    if (isSupabaseConfigured && supabase) {
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

        // Create or update profile directly on client
        const { error: profileError } = await supabase
          .from('tax_profiles')
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
        console.error('Direct Client SignUp Error:', err);
        return { success: false, error: err.message || '회원가입 중 오류가 발생했습니다.' };
      }
    } else {
      // Local Database Flow
      const db = getLocalDB();
      const exists = Object.values(db.users).some(u => u.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        return { success: false, error: '이미 사용중인 이메일입니다.' };
      }

      const generatedId = 'user_' + Math.random().toString(36).substr(2, 9);
      db.users[generatedId] = { email, name, passwordHash: password };
      
      const newProfile: UserProfile = {
        id: generatedId,
        name,
        bio,
        avatar_url: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
        updated_at: new Date().toISOString()
      };
      
      db.profiles[generatedId] = newProfile;
      db.currentUser = { id: generatedId, email, name };
      saveLocalDB(db);
      
      this.notifyAuthChange(db.currentUser);
      return { success: true, user: db.currentUser };
    }
  },

  async signIn(email: string, password: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
        if (!data.user) throw new Error('로그인에 실패했습니다.');

        let name = data.user.user_metadata?.full_name || email.split('@')[0];
        try {
          const { data: profile } = await supabase
            .from('tax_profiles')
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
        console.error('Direct Client Login Error:', err);
        return { success: false, error: err.message || '이메일 또는 비밀번호가 올바르지 않습니다.' };
      }
    } else {
      // Local Database Flow
      const db = getLocalDB();
      const matchedUserId = Object.keys(db.users).find(
        uid => db.users[uid].email.toLowerCase() === email.toLowerCase() && db.users[uid].passwordHash === password
      );

      if (!matchedUserId) {
        return { success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다.' };
      }

      const userRecord = db.users[matchedUserId];
      db.currentUser = { id: matchedUserId, email: userRecord.email, name: userRecord.name };
      saveLocalDB(db);
      
      this.notifyAuthChange(db.currentUser);
      return { success: true, user: db.currentUser };
    }
  },

  async signOut() {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error during Supabase signout:', e);
      }
    } else {
      const db = getLocalDB();
      db.currentUser = null;
      saveLocalDB(db);
    }
    this.notifyAuthChange(null);
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { user }, error } = await withTimeout(supabase.auth.getUser(), 2500);
        if (error || !user) return null;

        let name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
        try {
          const { data: p } = await withTimeout(
            supabase.from('tax_profiles').select('name').eq('id', user.id).single(),
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
    } else {
      return getLocalDB().currentUser;
    }
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('tax_profiles')
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
        console.error('Direct Client fetch profile error:', err);
        return null;
      }
    } else {
      const db = getLocalDB();
      return db.profiles[userId] || null;
    }
  },

  async updateProfile(userId: string, profileData: Partial<UserProfile>) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('tax_profiles')
          .upsert({
            id: userId,
            ...profileData,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Direct Client update profile error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      const existing = db.profiles[userId] || {
        id: userId,
        name: '사용자',
        bio: '',
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`,
        updated_at: ''
      };
      
      const updated = {
        ...existing,
        ...profileData,
        updated_at: new Date().toISOString()
      };
      
      db.profiles[userId] = updated;
      
      // Update name in currentUser record if active user is editing their own
      if (db.currentUser && db.currentUser.id === userId) {
        db.currentUser.name = updated.name;
        db.users[userId].name = updated.name;
      }
      
      // Sync names on posts written by this user
      db.posts = db.posts.map(p => {
        if (p.author_id === userId) {
          return { ...p, author_name: updated.name, author_avatar: updated.avatar_url };
        }
        return p;
      });

      // Sync names on comments
      db.comments = db.comments.map(c => {
        if (c.author_id === userId) {
          return { ...c, author_name: updated.name, author_avatar: updated.avatar_url };
        }
        return c;
      });

      saveLocalDB(db);
      this.notifyAuthChange(db.currentUser);
      return { success: true };
    }
  },

  async getPosts(): Promise<Post[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Fetch posts with elegant timeout limit (3000ms) to bypass cold sleep status fast
        const { data: rawPosts, error: postError } = await withTimeout(
          supabase
            .from('tax_posts')
            .select('id, title, content, author_id, created_at, views')
            .order('created_at', { ascending: false }),
          3000
        );

        if (postError) throw postError;

        const postsData = rawPosts || [];
        const authorIds = Array.from(new Set(postsData.map((p: any) => p.author_id).filter(Boolean)));

        // 2. Fetch profiles for these authors
        let profilesMap: Record<string, { name: string; avatar_url: string }> = {};
        if (authorIds.length > 0) {
          const { data: rawProfiles, error: profileError } = await withTimeout(
            supabase
              .from('tax_profiles')
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

        // 3. Map together to construct the expected frontend payload
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
        console.error('Direct Client fetch posts error:', err);
        return [];
      }
    } else {
      return [];
    }
  },

  async incrementViews(postId: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: post } = await supabase.from('tax_posts').select('views').eq('id', postId).single();
        if (post) {
          await supabase.from('tax_posts').update({ views: (post.views || 0) + 1 }).eq('id', postId);
        }
      } catch (e) {
        console.warn('Direct Client increment views error:', e);
      }
    } else {
      const db = getLocalDB();
      db.posts = db.posts.map(p => p.id === postId ? { ...p, views: p.views + 1 } : p);
      saveLocalDB(db);
    }
  },

  async createPost(title: string, content: string, userId: string): Promise<{ success: boolean; data?: Post; error?: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tax_posts')
          .insert({
            title,
            content,
            author_id: userId,
            created_at: new Date().toISOString(),
            views: 0
          })
          .select()
          .single();

        if (error) throw error;

        // Fetch writer's profile
        const { data: profile } = await supabase
          .from('tax_profiles')
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
          views: 0
        };

        return { success: true, data: newPost };
      } catch (err: any) {
        console.error('Direct Client create post error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      const profile = db.profiles[userId];
      
      const newPost: Post = {
        id: 'post_' + Math.random().toString(36).substr(2, 9),
        title,
        content,
        author_id: userId,
        author_name: profile?.name || '알 수 없음',
        author_avatar: profile?.avatar_url || '',
        created_at: new Date().toISOString(),
        views: 0
      };
      
      db.posts.push(newPost);
      saveLocalDB(db);
      return { success: true, data: newPost };
    }
  },

  async updatePost(id: string, title: string, content: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('tax_posts')
          .update({ title, content })
          .eq('id', id);

        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Direct Client update post error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      db.posts = db.posts.map(p => p.id === id ? { ...p, title, content } : p);
      saveLocalDB(db);
      return { success: true };
    }
  },

  async deletePost(id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        // Delete all comments belonging to this post first to prevent foreign key errors (tax_comments_post_id_fkey)
        await supabase
          .from('tax_comments')
          .delete()
          .eq('post_id', id);

        const { error } = await supabase
          .from('tax_posts')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Direct Client delete post error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      db.posts = db.posts.filter(p => p.id !== id);
      db.comments = db.comments.filter(c => c.post_id !== id);
      saveLocalDB(db);
      return { success: true };
    }
  },

  async getComments(postId: string): Promise<Comment[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Fetch comments
        const { data: rawComments, error: commentError } = await withTimeout(
          supabase
            .from('tax_comments')
            .select('id, post_id, author_id, content, created_at')
            .eq('post_id', postId)
            .order('created_at', { ascending: true }),
          2500
        );

        if (commentError) throw commentError;

        const commentsData = rawComments || [];
        const authorIds = Array.from(new Set(commentsData.map((c: any) => c.author_id).filter(Boolean)));

        // 2. Fetch profiles
        let profilesMap: Record<string, { name: string; avatar_url: string }> = {};
        if (authorIds.length > 0) {
          const { data: rawProfiles, error: profileError } = await withTimeout(
            supabase
              .from('tax_profiles')
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

        // 3. Map together to build the correct response structure
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

        // No local fallback
        comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(a.created_at).getTime());
        return comments;
        /*
        const cloudCommentIds = new Set(comments.map(c => c.id));
        const mergedComments = [...comments];
        
        localComments.forEach(lc => {
          if (!cloudCommentIds.has(lc.id)) {
            mergedComments.push(lc);
          }
        });

        mergedComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        */
      } catch (err) {
        console.error('Direct Client fetch comments error:', err);
        return [];
      }
    } else {
      return [];
    }
  },

  async createComment(postId: string, content: string, userId: string): Promise<{ success: boolean; data?: Comment; error?: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tax_comments')
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
          .from('tax_profiles')
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
        console.error('Direct Client create comment error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      const profile = db.profiles[userId];

      const newComment: Comment = {
        id: 'comment_' + Math.random().toString(36).substr(2, 9),
        post_id: postId,
        author_id: userId,
        author_name: profile?.name || '알 수 없음',
        author_avatar: profile?.avatar_url || '',
        content,
        created_at: new Date().toISOString()
      };

      db.comments.push(newComment);
      saveLocalDB(db);
      return { success: true, data: newComment };
    }
  },

  async createAnonymousPost(title: string, content: string, nickname: string): Promise<{ success: boolean; data?: Post; error?: string; isFallback?: boolean }> {
    let finalNickname = nickname.trim() || '익명';
    if (isSupabaseConfigured && supabase) {
      let userId = '';
      try {
        userId = await getOrCreateAnonUserSession();
      } catch (authErr: any) {
        console.warn('[Supabase] Anonymous session fetch failed:', authErr);
        userId = getClientDeviceUUID();
      }

      try {
        // Upsert profile with nickname
        const { error: profileError } = await supabase
          .from('tax_profiles')
          .upsert({
            id: userId,
            name: finalNickname,
            bio: '익명으로 작성된 본 질문/답변 프로필입니다.',
            avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalNickname)}`,
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          throw new Error(`사용자 프로필 테이블(tax_profiles) 등록 실패: ${profileError.message}`);
        }

        this.registerMyAnonAuthorId(userId);

        const result = await this.createPost(title, content, userId);
        if (result.success) {
          return result;
        } else {
          throw new Error(result.error || '게시글 테이블(tax_posts) 저장 실패');
        }
      } catch (dbErr: any) {
        console.error('[Supabase] Cloud raw insert failed:', dbErr);
        const errorMsg = dbErr?.message || '데이터베이스 연결 및 저장에 실패했습니다.';
        return { success: false, error: errorMsg };
      }
    } else {
      const db = getLocalDB();
      const fakeUserId = 'anon_' + Math.random().toString(36).substr(2, 9);
      const newPost: Post = {
        id: 'post_' + Math.random().toString(36).substr(2, 9),
        title,
        content,
        author_id: fakeUserId,
        author_name: finalNickname,
        author_avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalNickname)}`,
        created_at: new Date().toISOString(),
        views: 0
      };
      db.posts.unshift(newPost);
      saveLocalDB(db);
      this.registerMyAnonAuthorId(fakeUserId);
      return { success: true, data: newPost };
    }
  },

  async createAnonymousComment(postId: string, content: string, nickname: string): Promise<{ success: boolean; data?: Comment; error?: string; isFallback?: boolean }> {
    let finalNickname = nickname.trim() || '익명';
    if (isSupabaseConfigured && supabase) {
      let userId = '';
      try {
        userId = await getOrCreateAnonUserSession();
      } catch (authErr: any) {
        console.warn('[Supabase] Anonymous auth disabled or failed for comment. Proceeding with robust device UUID fallback:', authErr);
        userId = getClientDeviceUUID();
      }

      try {
        // Upsert profile with nickname
        const { error: profileError } = await supabase
          .from('tax_profiles')
          .upsert({
            id: userId,
            name: finalNickname,
            bio: '익명 사용자',
            avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalNickname)}`,
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          throw new Error(`사용자 프로필 테이블(tax_profiles) 등록 실패: ${profileError.message}`);
        }

        this.registerMyAnonAuthorId(userId);

        const result = await this.createComment(postId, content, userId);
        if (result.success) {
          return result;
        } else {
          throw new Error(result.error || '댓글 테이블(tax_comments) 저장 실패');
        }
      } catch (dbErr: any) {
        console.error('[Supabase] Cloud raw comment insert failed:', dbErr);
        const errorMsg = dbErr?.message || '데이터베이스 연결 및 댓글 저장에 실패했습니다.';
        return { success: false, error: errorMsg };
      }
    } else {
      const db = getLocalDB();
      const fakeUserId = 'anon_' + Math.random().toString(36).substr(2, 9);
      const newComment: Comment = {
        id: 'comment_' + Math.random().toString(36).substr(2, 9),
        post_id: postId,
        author_id: fakeUserId,
        author_name: finalNickname,
        author_avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalNickname)}`,
        content,
        created_at: new Date().toISOString()
      };
      db.comments.push(newComment);
      saveLocalDB(db);
      this.registerMyAnonAuthorId(fakeUserId);
      return { success: true, data: newComment };
    }
  },

  async deleteComment(id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('tax_comments')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Direct Client delete comment error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      db.comments = db.comments.filter(c => c.id !== id);
      saveLocalDB(db);
      return { success: true };
    }
  }
};
