import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

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

const supabaseUrlRaw = process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = cleanSupabaseUrl(supabaseUrlRaw);
const supabaseAnonKey = cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY || '');

const isSupabaseConfigured = 
  supabaseUrl.trim() !== '' && 
  supabaseAnonKey.trim() !== '' && 
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE');

console.log('Supabase config on server load:', {
  url: supabaseUrl ? 'Configured (starts with ' + supabaseUrl.substring(0, 15) + '...)' : 'Missing',
  key: supabaseAnonKey ? 'Configured (starts with ' + supabaseAnonKey.substring(0, 15) + '...)' : 'Missing',
  isSupabaseConfigured
});

// Helper to construct a client scoped to the requesting user's Bearer JWT
function getSupabaseClient(authHeader?: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured on the server-side. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Return a default client using service config
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// Extract authenticated user info securely from a token
async function getAuthenticatedUser(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) {
      console.warn('Authentication token verification failed:', error?.message);
      return null;
    }
    return user;
  } catch (err) {
    console.error('Error verifying token:', err);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parser for payload bodies
  app.use(express.json());

  // Logging middleware for debugging API calls
  app.use((req, res, next) => {
    console.log(`[Proxy Server Log] ${req.method} ${req.url}`);
    next();
  });

  // API Proxy Endpoints for Supabase

  // 0. Configuration check endpoint
  app.get('/api/config', (req, res) => {
    res.json({
      isSupabaseConfigured,
      supabaseUrl: isSupabaseConfigured ? supabaseUrl : ''
    });
  });

  // 1. SIGN UP proxy
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, name, bio, avatarUrl } = req.body;
      if (!isSupabaseConfigured) {
        return res.status(400).json({ error: 'Supabase is not configured yet.' });
      }

      const client = createClient(supabaseUrl, supabaseAnonKey);
      
      // Sign up the user (auth auth.signUp)
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('회원가입에 실패했습니다 (User empty)');

      const userId = data.user.id;

      // Upsert into tax_profiles
      const { error: profileError } = await client
        .from('tax_profiles')
        .upsert({
          id: userId,
          name: name,
          bio: bio || '',
          avatar_url: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.warn('Profile automatic creation failed on proxy:', profileError.message);
      }

      // Return both session and user details
      res.json({
        success: true,
        session: data.session,
        user: {
          id: userId,
          email: data.user.email,
          name: name
        }
      });
    } catch (err: any) {
      console.error('[Proxy server] Sign up error:', err);
      res.status(500).json({ error: err.message || 'Server Sign up failure' });
    }
  });

  // 2. SIGN IN proxy
  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!isSupabaseConfigured) {
        return res.status(400).json({ error: 'Supabase is not configured yet.' });
      }

      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (!data.user) throw new Error('로그인에 실패했습니다.');

      // Try to get updated profile name
      let name = data.user.user_metadata?.full_name || email.split('@')[0];
      try {
        const { data: profile } = await client
          .from('tax_profiles')
          .select('name')
          .eq('id', data.user.id)
          .single();
        if (profile && profile.name) {
          name = profile.name;
        }
      } catch (_) {}

      res.json({
        success: true,
        session: data.session,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: name
        }
      });
    } catch (err: any) {
      console.error('[Proxy server] Sign in error:', err);
      res.status(500).json({ error: err.message || 'Server Sign in failure' });
    }
  });

  // 3. GET CURRENT USER proxy
  app.get('/api/auth/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized user token' });
      }

      const client = createClient(supabaseUrl, supabaseAnonKey);
      let name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      try {
        const { data: p } = await client.from('tax_profiles').select('name').eq('id', user.id).single();
        if (p?.name) name = p.name;
      } catch (_) {}

      res.json({
        id: user.id,
        email: user.email || '',
        name
      });
    } catch (err: any) {
      console.error('[Proxy server] getAuthUser error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. GET BOARD POSTS proxy
  app.get('/api/posts', async (req, res) => {
    try {
      const client = getSupabaseClient(req.headers.authorization);
      
      // 1. Fetch posts
      const { data: rawPosts, error: postError } = await client
        .from('tax_posts')
        .select('id, title, content, author_id, created_at, views')
        .order('created_at', { ascending: false });

      if (postError) throw postError;

      const postsData = rawPosts || [];
      const authorIds = Array.from(new Set(postsData.map((p: any) => p.author_id).filter(Boolean)));

      // 2. Fetch profiles for these authors
      let profilesMap: Record<string, { name: string; avatar_url: string }> = {};
      if (authorIds.length > 0) {
        const { data: rawProfiles, error: profileError } = await client
          .from('tax_profiles')
          .select('id, name, avatar_url')
          .in('id', authorIds);

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

      res.json(posts);
    } catch (err: any) {
      console.error('[Proxy server] Fetch posts error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 5. CREATE POST proxy
  app.post('/api/posts', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized user action' });
      }

      const { title, content } = req.body;
      const client = getSupabaseClient(authHeader);
      
      const { data, error } = await client
        .from('tax_posts')
        .insert({
          title,
          content,
          author_id: user.id,
          created_at: new Date().toISOString(),
          views: 0
        })
        .select()
        .single();

      if (error) throw error;

      // Get profile info to return clean structure
      const { data: profile } = await client
        .from('tax_profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single();

      res.json({
        success: true,
        data: {
          id: data.id,
          title: data.title,
          content: data.content,
          author_id: data.author_id,
          author_name: profile?.name || '알 수 없음',
          author_avatar: profile?.avatar_url || '',
          created_at: data.created_at,
          views: 0
        }
      });
    } catch (err: any) {
      console.error('[Proxy server] Create post error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 6. UPDATE POST proxy
  app.put('/api/posts/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized user action' });
      }

      const { title, content } = req.body;
      const postId = req.params.id;
      const client = getSupabaseClient(authHeader);

      const { error } = await client
        .from('tax_posts')
        .update({ title, content })
        .eq('id', postId);

      if (error) throw error;

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Proxy server] Update post error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 7. DELETE POST proxy
  app.delete('/api/posts/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized user action' });
      }

      const postId = req.params.id;
      const client = getSupabaseClient(authHeader);

      const { error } = await client
        .from('tax_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Proxy server] Delete post error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 8. INCREMENT VIEWS proxy
  app.post('/api/posts/:id/view', async (req, res) => {
    try {
      const postId = req.params.id;
      const client = createClient(supabaseUrl, supabaseAnonKey);
      
      const { data: post } = await client.from('tax_posts').select('views').eq('id', postId).single();
      if (post) {
        await client.from('tax_posts').update({ views: (post.views || 0) + 1 }).eq('id', postId);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.warn('[Proxy server] Could not increment views:', err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // 9. GET PROFILE proxy
  app.get('/api/profiles/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const client = createClient(supabaseUrl, supabaseAnonKey);
      
      const { data, error } = await client
        .from('tax_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.json({
            id: userId,
            name: '사용자',
            bio: '',
            avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`,
            updated_at: new Date().toISOString()
          });
        }
        throw error;
      }
      res.json(data);
    } catch (err: any) {
      console.error('[Proxy server] Fetch profile error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 10. UPDATE PROFILE proxy
  app.put('/api/profiles/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);
      if (!user || user.id !== req.params.id) {
        return res.status(401).json({ error: 'Unauthorized user action' });
      }

      const profileData = req.body;
      const client = getSupabaseClient(authHeader);

      const { error } = await client
        .from('tax_profiles')
        .upsert({
          id: user.id,
          ...profileData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Proxy server] Update profile error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 11. GET COMMENTS proxy
  app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
      const postId = req.params.postId;
      const client = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Fetch comments
      const { data: rawComments, error: commentError } = await client
        .from('tax_comments')
        .select('id, post_id, author_id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentError) throw commentError;

      const commentsData = rawComments || [];
      const authorIds = Array.from(new Set(commentsData.map((c: any) => c.author_id).filter(Boolean)));

      // 2. Fetch profiles
      let profilesMap: Record<string, { name: string; avatar_url: string }> = {};
      if (authorIds.length > 0) {
        const { data: rawProfiles, error: profileError } = await client
          .from('tax_profiles')
          .select('id, name, avatar_url')
          .in('id', authorIds);

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

      res.json(comments);
    } catch (err: any) {
      console.error('[Proxy server] Fetch comments error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 12. CREATE COMMENT proxy
  app.post('/api/posts/:postId/comments', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized user action' });
      }

      const { content } = req.body;
      const postId = req.params.postId;
      const client = getSupabaseClient(authHeader);

      const { data, error } = await client
        .from('tax_comments')
        .insert({
          post_id: postId,
          content,
          author_id: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const { data: profile } = await client
        .from('tax_profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single();

      res.json({
        success: true,
        data: {
          id: data.id,
          post_id: data.post_id,
          author_id: data.author_id,
          author_name: profile?.name || '알 수 없음',
          author_avatar: profile?.avatar_url || '',
          content: data.content,
          created_at: data.created_at
        }
      });
    } catch (err: any) {
      console.error('[Proxy server] Create comment error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 13. DELETE COMMENT proxy
  app.delete('/api/comments/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized user action' });
      }

      const commentId = req.params.id;
      const client = getSupabaseClient(authHeader);

      const { error } = await client
        .from('tax_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Proxy server] Delete comment error:', err);
      res.status(500).json({ error: err.message });
    }
  });


  // Server setup for static bundle vs Vite dev middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve index.html for SPA page loads
    app.all('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Proxy Server Running] Server started on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Proxy Server Start Failure]', err);
});
