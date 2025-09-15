// Database Configuration and Setup
import { createClient } from '@supabase/supabase-js';

// Database Schema Migrations
export const databaseSchema = `
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'free',
  api_tokens JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  agent_memory JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent messages table
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  message_type TEXT DEFAULT 'user_input',
  input_data JSONB,
  output_data JSONB,
  validation_status TEXT DEFAULT 'pending',
  processing_time_ms INTEGER,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  assigned_to TEXT,
  recurrence_rule JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  members JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'google', 'microsoft', 'linkedin'
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_errors JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content JSONB NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled',
  post_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  session_id TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- User access policies
CREATE POLICY "Users can access own data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can access own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own messages" ON agent_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own projects" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own integrations" ON integrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own scheduled posts" ON scheduled_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own analytics" ON analytics_events FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_id ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_user_id ON agent_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

// Database Service Layer
export class DatabaseService {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }

  // User Management
  async createUser(userData: any) {
    const { data, error } = await this.supabase
      .from('users')
      .insert(userData)
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async getUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateUserPreferences(userId: string, preferences: any) {
    const { data, error } = await this.supabase
      .from('users')
      .update({ preferences })
      .eq('id', userId)
      .select();
    
    if (error) throw error;
    return data[0];
  }

  // Conversation Management
  async createConversation(userId: string, title?: string) {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: title || `Conversation ${new Date().toLocaleDateString()}`
      })
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async saveAgentMessage(messageData: any) {
    const { data, error } = await this.supabase
      .from('agent_messages')
      .insert(messageData)
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async getConversationHistory(conversationId: string, limit = 50) {
    const { data, error } = await this.supabase
      .from('agent_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  // Task Management
  async createTask(taskData: any) {
    const { data, error } = await this.supabase
      .from('tasks')
      .insert(taskData)
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async updateTask(taskId: string, updates: any) {
    const { data, error } = await this.supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async getUserTasks(userId: string, filters?: any) {
    let query = this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async deleteTask(taskId: string) {
    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) throw error;
  }

  // Integration Management
  async saveIntegration(integrationData: any) {
    const { data, error } = await this.supabase
      .from('integrations')
      .upsert(integrationData, { onConflict: 'user_id,platform' })
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async getIntegration(userId: string, platform: string) {
    const { data, error } = await this.supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getUserIntegrations(userId: string) {
    const { data, error } = await this.supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) throw error;
    return data;
  }

  // Scheduled Posts
  async schedulePost(postData: any) {
    const { data, error } = await this.supabase
      .from('scheduled_posts')
      .insert(postData)
      .select();
    
    if (error) throw error;
    return data[0];
  }

  async getPendingPosts() {
    const { data, error } = await this.supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString());
    
    if (error) throw error;
    return data;
  }

  async updatePostStatus(postId: string, status: string, postResultId?: string, errorMessage?: string) {
    const updates: any = { 
      status, 
      processed_at: new Date().toISOString() 
    };
    
    if (postResultId) updates.post_id = postResultId;
    if (errorMessage) updates.error_message = errorMessage;

    const { data, error } = await this.supabase
      .from('scheduled_posts')
      .update(updates)
      .eq('id', postId)
      .select();
    
    if (error) throw error;
    return data[0];
  }

  // Analytics
  async trackEvent(eventData: any) {
    const { data, error } = await this.supabase
      .from('analytics_events')
      .insert(eventData);
    
    if (error) console.error('Analytics tracking error:', error);
    return data;
  }

  async getAnalytics(userId: string, timeframe: string) {
    const startDate = new Date();
    const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());
    
    if (error) throw error;
    return data;
  }
}

// Complete System Integration
export class ChiefOfStaffSystemIntegrated {
  private db: DatabaseService;
  private chiefOfStaff: any;
  private googleAgent: any;
  private microsoftAgent: any;
  private linkedinAgent: any;
  private contentAgent: any;
  private taskAgent: any;

  constructor() {
    this.db = new DatabaseService();
    this.initializeSystem();
  }

  private async initializeSystem() {
    const { ChiefOfStaffAgent } = await import('./chief_of_staff_core');
    const { GoogleAgent, MicrosoftAgent } = await import('./integration_agents');
    const { LinkedInAgent, ContentAgent } = await import('./content_linkedin_agents');
    const { TaskAgent } = await import('./task_management_webapp');

    this.chiefOfStaff = new ChiefOfStaffAgent();
    this.taskAgent = new TaskAgent();
    
    // Register agents with Chief of Staff
    this.chiefOfStaff.addAgent('task', this.taskAgent);
    
    // Initialize integration agents when user connects
  }

  async processUserRequest(userInput: string, userId: string, conversationId?: string) {
    try {
      // Track user interaction
      await this.db.trackEvent({
        user_id: userId,
        event_type: 'user_request',
        event_data: { input: userInput },
        session_id: `session_${Date.now()}`
      });

      // Create or get conversation
      let conversation;
      if (conversationId) {
        conversation = { id: conversationId };
      } else {
        conversation = await this.db.createConversation(userId);
      }

      // Get user integrations
      const integrations = await this.db.getUserIntegrations(userId);
      
      // Initialize platform agents based on user integrations
      await this.initializePlatformAgents(integrations);

      // Process with Chief of Staff
      const response = await this.chiefOfStaff.processUserRequest(userInput, userId);

      // Save conversation
      await this.db.saveAgentMessage({
        conversation_id: conversation.id,
        user_id: userId,
        agent_type: 'chief',
        message_type: 'user_input',
        input_data: { userInput },
        output_data: response,
        processing_time_ms: response.processing_summary?.total_time || 0
      });

      // Handle specific results
      if (response.intent === 'task_management' && response.success) {
        await this.handleTaskResult(response, userId);
      }

      if (response.intent === 'linkedin_action' && response.success) {
        await this.handleLinkedInResult(response, userId);
      }

      return {
        ...response,
        conversationId: conversation.id
      };

    } catch (error) {
      console.error('System error:', error);
      
      await this.db.trackEvent({
        user_id: userId,
        event_type: 'system_error',
        event_data: { error: error.message, input: userInput }
      });

      return {
        success: false,
        message: 'I encountered an error processing your request. Please try again.',
        error: error.message
      };
    }
  }

  private async initializePlatformAgents(integrations: any[]) {
    for (const integration of integrations) {
      switch (integration.platform) {
        case 'google':
          if (!this.googleAgent) {
            const { GoogleAgent } = await import('./integration_agents');
            this.googleAgent = new GoogleAgent({
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
              redirectUri: process.env.GOOGLE_REDIRECT_URI!
            });
            this.googleAgent.setAccessToken(integration.access_token_encrypted);
            this.chiefOfStaff.addAgent('google', this.googleAgent);
          }
          break;

        case 'microsoft':
          if (!this.microsoftAgent) {
            const { MicrosoftAgent } = await import('./integration_agents');
            this.microsoftAgent = new MicrosoftAgent(integration.access_token_encrypted);
            this.chiefOfStaff.addAgent('microsoft', this.microsoftAgent);
          }
          break;

        case 'linkedin':
          if (!this.linkedinAgent) {
            const { LinkedInAgent } = await import('./content_linkedin_agents');
            this.linkedinAgent = new LinkedInAgent(integration.access_token_encrypted);
            this.chiefOfStaff.addAgent('linkedin', this.linkedinAgent);
          }
          break;
      }
    }

    // Always initialize content agent
    if (!this.contentAgent) {
      const { ContentAgent } = await import('./content_linkedin_agents');
      this.contentAgent = new ContentAgent();
      this.chiefOfStaff.addAgent('content', this.contentAgent);
    }
  }

  private async handleTaskResult(response: any, userId: string) {
    const taskData = response.results?.find(r => r.task);
    if (taskData?.task) {
      await this.db.createTask({
        ...taskData.task,
        user_id: userId
      });
    }
  }

  private async handleLinkedInResult(response: any, userId: string) {
    const postData = response.results?.find(r => r.scheduledPostId || r.postId);
    if (postData?.scheduledPostId) {
      await this.db.schedulePost({
        user_id: userId,
        platform: 'linkedin',
        content: { text: postData.content },
        scheduled_for: postData.scheduledFor,
        status: 'scheduled'
      });
    }
  }

  // OAuth Integration Setup
  async initiateOAuth(platform: string, userId: string) {
    const redirectUri = `${process.env.BASE_URL}/api/oauth/callback/${platform}`;
    
    switch (platform) {
      case 'google':
        return `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
          `redirect_uri=${redirectUri}&` +
          `scope=https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive&` +
          `response_type=code&` +
          `state=${userId}`;

      case 'microsoft':
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
          `client_id=${process.env.MICROSOFT_CLIENT_ID}&` +
          `redirect_uri=${redirectUri}&` +
          `scope=https://graph.microsoft.com/calendars.readwrite https://graph.microsoft.com/mail.send&` +
          `response_type=code&` +
          `state=${userId}`;

      case 'linkedin':
        return `https://www.linkedin.com/oauth/v2/authorization?` +
          `response_type=code&` +
          `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
          `redirect_uri=${redirectUri}&` +
          `scope=r_liteprofile w_member_social&` +
          `state=${userId}`;

      default:
        throw new Error('Unsupported platform');
    }
  }

  async handleOAuthCallback(platform: string, code: string, userId: string) {
    // Exchange code for tokens and save to database
    const tokenData = await this.exchangeCodeForTokens(platform, code);
    
    await this.db.saveIntegration({
      user_id: userId,
      platform,
      access_token_encrypted: tokenData.access_token,
      refresh_token_encrypted: tokenData.refresh_token,
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
      scope: tokenData.scope?.split(' ') || [],
      is_active: true
    });

    return { success: true, platform };
  }

  private async exchangeCodeForTokens(platform: string, code: string) {
    // Implementation for token exchange for each platform
    // This would make HTTP requests to respective OAuth endpoints
    return {
      access_token: 'dummy_token',
      refresh_token: 'dummy_refresh_token',
      expires_in: 3600,
      scope: 'dummy_scope'
    };
  }

  // Background job processing
  async processScheduledPosts() {
    const pendingPosts = await this.db.getPendingPosts();
    
    for (const post of pendingPosts) {
      try {
        // Get user's LinkedIn integration
        const integration = await this.db.getIntegration(post.user_id, post.platform);
        
        if (!integration) {
          await this.db.updatePostStatus(post.id, 'failed', undefined, 'Integration not found');
          continue;
        }

        // Initialize agent and post
        if (post.platform === 'linkedin' && this.linkedinAgent) {
          this.linkedinAgent.setAccessToken(integration.access_token_encrypted);
          // Post the content
          const result = await this.linkedinAgent.createPost({
            id: `scheduled_${post.id}`,
            from: 'system',
            to: 'linkedin',
            timestamp: new Date(),
            payload: {
              task: 'create_post',
              context: { content: post.content.text },
              priority: 'medium',
              validation_required: false
            },
            metadata: {
              user_id: post.user_id,
              session_id: `scheduled_${post.id}`,
              conversation_id: `scheduled_${post.id}`
            }
          });

          if (result.status === 'success') {
            await this.db.updatePostStatus(post.id, 'posted', result.data.postId);
          } else {
            await this.db.updatePostStatus(post.id, 'failed', undefined, result.error);
          }
        }
      } catch (error) {
        await this.db.updatePostStatus(post.id, 'failed', undefined, error.message);
      }
    }
  }

  // User management
  async getUserDashboard(userId: string) {
    const [tasks, integrations, analytics] = await Promise.all([
      this.db.getUserTasks(userId),
      this.db.getUserIntegrations(userId),
      this.db.getAnalytics(userId, 'week')
    ]);

    return {
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => 
          t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
        ).length
      },
      integrations: integrations.map(i => ({
        platform: i.platform,
        connected: i.is_active,
        lastSync: i.last_sync
      })),
      activity: {
        totalRequests: analytics.length,
        requestsThisWeek: analytics.filter(a => 
          new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length
      }
    };
  }

  async exportUserData(userId: string) {
    const [user, conversations, tasks, integrations, analytics] = await Promise.all([
      this.db.getUser(userId),
      this.db.supabase.from('conversations').select('*').eq('user_id', userId),
      this.db.getUserTasks(userId),
      this.db.getUserIntegrations(userId),
      this.db.getAnalytics(userId, 'year')
    ]);

    return {
      user,
      conversations: conversations.data,
      tasks,
      integrations: integrations.map(i => ({
        platform: i.platform,
        created_at: i.created_at,
        // Don't export tokens for security
      })),
      analytics: analytics.map(a => ({
        event_type: a.event_type,
        created_at: a.created_at,
        // Remove sensitive data
      }))
    };
  }
}
