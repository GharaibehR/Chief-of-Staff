import { BaseAgent, AgentMessage, AgentResponse } from './chief_of_staff_core';

// LinkedIn Integration Agent
export class LinkedInAgent extends BaseAgent {
  private accessToken: string;
  private apiBaseUrl = 'https://api.linkedin.com/v2';

  constructor(accessToken: string) {
    super('linkedin');
    this.accessToken = accessToken;
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'create_post':
          return await this.createPost(message);
        case 'schedule_post':
          return await this.schedulePost(message);
        case 'send_message':
          return await this.sendMessage(message);
        case 'search_connections':
          return await this.searchConnections(message);
        case 'get_profile':
          return await this.getProfile(message);
        case 'analyze_network':
          return await this.analyzeNetwork(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown LinkedIn action');
      }
    } catch (error) {
      this.log('error', 'LinkedIn API error', error);
      return this.createResponse(message.id, 'error', null, error.message);
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('post') && (taskLower.includes('schedule') || taskLower.includes('later'))) {
      return 'schedule_post';
    }
    if (taskLower.includes('post') || taskLower.includes('share') || taskLower.includes('publish')) {
      return 'create_post';
    }
    if (taskLower.includes('message') || taskLower.includes('send') || taskLower.includes('dm')) {
      return 'send_message';
    }
    if (taskLower.includes('search') || taskLower.includes('find') || taskLower.includes('connections')) {
      return 'search_connections';
    }
    if (taskLower.includes('profile') || taskLower.includes('about me')) {
      return 'get_profile';
    }
    if (taskLower.includes('analyze') || taskLower.includes('network')) {
      return 'analyze_network';
    }
    
    return 'unknown';
  }

  private async createPost(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const postContent = context.content || context.previousResult?.content || message.payload.task;
      
      const postData = {
        author: 'urn:li:person:' + await this.getCurrentUserId(),
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postContent
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };

      const response = await this.makeLinkedInRequest('/ugcPosts', 'POST', postData);

      this.log('info', 'LinkedIn post created', { postId: response.id });

      return this.createResponse(message.id, 'success', {
        postId: response.id,
        content: postContent,
        visibility: 'PUBLIC',
        platform: 'linkedin',
        status: 'published',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to create LinkedIn post: ${error.message}`);
    }
  }

  private async schedulePost(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const postContent = context.content || context.previousResult?.content || message.payload.task;
      const scheduledTime = this.parseScheduleTime(message.payload.task, context);

      // For demo purposes, we'll store the scheduled post locally
      // In production, you'd use a job queue like Bull or implement LinkedIn's scheduling
      const scheduledPost = {
        id: `scheduled_${Date.now()}`,
        content: postContent,
        scheduledFor: scheduledTime,
        status: 'scheduled',
        platform: 'linkedin',
        created: new Date().toISOString()
      };

      // Store in a scheduling system (Redis, database, etc.)
      await this.storeScheduledPost(scheduledPost);

      this.log('info', 'LinkedIn post scheduled', { 
        postId: scheduledPost.id, 
        scheduledFor: scheduledTime 
      });

      return this.createResponse(message.id, 'success', {
        scheduledPostId: scheduledPost.id,
        content: postContent,
        scheduledFor: scheduledTime,
        platform: 'linkedin',
        status: 'scheduled'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to schedule LinkedIn post: ${error.message}`);
    }
  }

  private async sendMessage(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const messageDetails = this.parseMessageDetails(message.payload.task, context);

      const conversationData = {
        recipients: [messageDetails.recipientId],
        subject: messageDetails.subject
      };

      // Create conversation
      const conversation = await this.makeLinkedInRequest('/messaging/conversations', 'POST', conversationData);

      // Send message
      const messageData = {
        messageBody: {
          text: messageDetails.content
        }
      };

      await this.makeLinkedInRequest(
        `/messaging/conversations/${conversation.id}/messages`, 
        'POST', 
        messageData
      );

      this.log('info', 'LinkedIn message sent', { conversationId: conversation.id });

      return this.createResponse(message.id, 'success', {
        conversationId: conversation.id,
        recipient: messageDetails.recipient,
        subject: messageDetails.subject,
        content: messageDetails.content,
        platform: 'linkedin',
        status: 'sent'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to send LinkedIn message: ${error.message}`);
    }
  }

  private async searchConnections(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const searchTerm = context.searchTerm || this.extractSearchTerm(message.payload.task);

      const response = await this.makeLinkedInRequest(
        `/people/search?q=${encodeURIComponent(searchTerm)}&count=20`
      );

      const connections = response.elements || [];

      return this.createResponse(message.id, 'success', {
        connections: connections.map(connection => ({
          id: connection.id,
          name: `${connection.firstName} ${connection.lastName}`,
          headline: connection.headline,
          location: connection.location?.name,
          industry: connection.industry,
          profileUrl: connection.publicProfileUrl
        })),
        totalFound: connections.length,
        searchTerm,
        platform: 'linkedin'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to search connections: ${error.message}`);
    }
  }

  private async getProfile(message: AgentMessage): Promise<AgentResponse> {
    try {
      const response = await this.makeLinkedInRequest('/people/~:(id,first-name,last-name,headline,summary,location,industry,public-profile-url)');

      return this.createResponse(message.id, 'success', {
        profile: {
          id: response.id,
          name: `${response.firstName} ${response.lastName}`,
          headline: response.headline,
          summary: response.summary,
          location: response.location?.name,
          industry: response.industry,
          profileUrl: response.publicProfileUrl
        },
        platform: 'linkedin'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to get profile: ${error.message}`);
    }
  }

  private async analyzeNetwork(message: AgentMessage): Promise<AgentResponse> {
    try {
      // Get connections and analyze
      const connectionsResponse = await this.makeLinkedInRequest('/people/~/connections?count=500');
      const connections = connectionsResponse.values || [];

      const analysis = {
        totalConnections: connections.length,
        industries: this.analyzeIndustries(connections),
        locations: this.analyzeLocations(connections),
        topCompanies: this.analyzeCompanies(connections),
        recommendations: this.generateNetworkRecommendations(connections)
      };

      return this.createResponse(message.id, 'success', {
        networkAnalysis: analysis,
        platform: 'linkedin',
        analyzedAt: new Date().toISOString()
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to analyze network: ${error.message}`);
    }
  }

  private async makeLinkedInRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async getCurrentUserId(): Promise<string> {
    const profile = await this.makeLinkedInRequest('/people/~:(id)');
    return profile.id;
  }

  private parseScheduleTime(task: string, context: any): string {
    if (context.scheduledTime) return context.scheduledTime;
    
    const timeMatch = task.match(/(?:at|@)\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    const dateMatch = task.match(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    
    const now = new Date();
    let scheduledTime = new Date(now);
    
    if (dateMatch) {
      const dateStr = dateMatch[1].toLowerCase();
      if (dateStr === 'tomorrow') {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      } else if (dateStr === 'next week') {
        scheduledTime.setDate(scheduledTime.getDate() + 7);
      }
    }
    
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const period = timeMatch[3]?.toLowerCase();
      
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      scheduledTime.setHours(hours, minutes, 0, 0);
    } else {
      // Default to 9 AM if no time specified
      scheduledTime.setHours(9, 0, 0, 0);
    }
    
    return scheduledTime.toISOString();
  }

  private parseMessageDetails(task: string, context: any) {
    return {
      recipient: context.recipient || this.extractRecipient(task),
      recipientId: context.recipientId || 'urn:li:person:RECIPIENT_ID',
      subject: context.subject || this.extractSubject(task),
      content: context.content || context.previousResult?.content || this.extractMessageContent(task)
    };
  }

  private extractSearchTerm(task: string): string {
    const match = task.match(/(?:search|find)\s+(?:for\s+)?(.+?)(?:\s+(?:in|on|connections))?$/i);
    return match ? match[1].trim() : 'connections';
  }

  private extractRecipient(task: string): string {
    const match = task.match(/(?:send|message)\s+(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    return match ? match[1] : 'Connection';
  }

  private extractSubject(task: string): string {
    const match = task.match(/subject[:\s]+([^.]+)/i);
    return match ? match[1].trim() : 'Message from Chief of Staff';
  }

  private extractMessageContent(task: string): string {
    const match = task.match(/(?:saying|message)[:\s]+([^.]+)/i);
    return match ? match[1].trim() : 'Hello! Sent via Chief of Staff.';
  }

  private async storeScheduledPost(post: any): Promise<void> {
    // In production, store in Redis or database
    console.log('Storing scheduled post:', post);
  }

  private analyzeIndustries(connections: any[]): Record<string, number> {
    const industries: Record<string, number> = {};
    connections.forEach(conn => {
      if (conn.industry) {
        industries[conn.industry] = (industries[conn.industry] || 0) + 1;
      }
    });
    return Object.fromEntries(
      Object.entries(industries).sort(([,a], [,b]) => b - a).slice(0, 10)
    );
  }

  private analyzeLocations(connections: any[]): Record<string, number> {
    const locations: Record<string, number> = {};
    connections.forEach(conn => {
      if (conn.location?.name) {
        locations[conn.location.name] = (locations[conn.location.name] || 0) + 1;
      }
    });
    return Object.fromEntries(
      Object.entries(locations).sort(([,a], [,b]) => b - a).slice(0, 10)
    );
  }

  private analyzeCompanies(connections: any[]): Record<string, number> {
    const companies: Record<string, number> = {};
    connections.forEach(conn => {
      if (conn.currentPositions?.values?.[0]?.company?.name) {
        const company = conn.currentPositions.values[0].company.name;
        companies[company] = (companies[company] || 0) + 1;
      }
    });
    return Object.fromEntries(
      Object.entries(companies).sort(([,a], [,b]) => b - a).slice(0, 10)
    );
  }

  private generateNetworkRecommendations(connections: any[]): string[] {
    const recommendations = [];
    
    if (connections.length < 100) {
      recommendations.push('Consider expanding your network to reach 100+ connections');
    }
    
    const industries = this.analyzeIndustries(connections);
    const topIndustry = Object.keys(industries)[0];
    if (topIndustry) {
      recommendations.push(`Your network is strong in ${topIndustry} - consider diversifying to other industries`);
    }
    
    recommendations.push('Engage more with connections through posts and comments');
    recommendations.push('Share industry insights to increase visibility');
    
    return recommendations;
  }

  public setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

// Content Generation Agent
export class ContentAgent extends BaseAgent {
  private userStyle: any = {};
  private templates: Record<string, string> = {};

  constructor(userStyle?: any) {
    super('content');
    this.userStyle = userStyle || {};
    this.initializeTemplates();
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'generate_email':
          return await this.generateEmail(message);
        case 'generate_linkedin_post':
          return await this.generateLinkedInPost(message);
        case 'generate_response':
          return await this.generateResponse(message);
        case 'generate_document':
          return await this.generateDocument(message);
        case 'improve_content':
          return await this.improveContent(message);
        case 'analyze_tone':
          return await this.analyzeTone(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown content action');
      }
    } catch (error) {
      this.log('error', 'Content generation error', error);
      return this.createResponse(message.id, 'error', null, error.message);
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('email') || taskLower.includes('draft')) {
      return 'generate_email';
    }
    if (taskLower.includes('linkedin') || taskLower.includes('post') || taskLower.includes('social')) {
      return 'generate_linkedin_post';
    }
    if (taskLower.includes('reply') || taskLower.includes('respond')) {
      return 'generate_response';
    }
    if (taskLower.includes('document') || taskLower.includes('report')) {
      return 'generate_document';
    }
    if (taskLower.includes('improve') || taskLower.includes('enhance') || taskLower.includes('better')) {
      return 'improve_content';
    }
    if (taskLower.includes('tone') || taskLower.includes('analyze') || taskLower.includes('style')) {
      return 'analyze_tone';
    }
    
    return 'generate_email'; // Default
  }

  private async generateEmail(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const emailDetails = this.parseEmailRequest(message.payload.task, context);
      
      const content = await this.generateEmailContent(emailDetails);
      
      this.log('info', 'Email content generated', { 
        recipient: emailDetails.recipient,
        subject: emailDetails.subject 
      });

      return this.createResponse(message.id, 'success', {
        type: 'email',
        content,
        subject: emailDetails.subject,
        recipient: emailDetails.recipient,
        tone: emailDetails.tone,
        wordCount: content.split(' ').length,
        platform: 'email'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to generate email: ${error.message}`);
    }
  }

  private async generateLinkedInPost(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const postDetails = this.parseLinkedInRequest(message.payload.task, context);
      
      const content = await this.generateLinkedInContent(postDetails);
      
      this.log('info', 'LinkedIn post generated', { 
        topic: postDetails.topic,
        tone: postDetails.tone 
      });

      return this.createResponse(message.id, 'success', {
        type: 'linkedin_post',
        content,
        topic: postDetails.topic,
        tone: postDetails.tone,
        hashtags: postDetails.hashtags,
        characterCount: content.length,
        platform: 'linkedin'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to generate LinkedIn post: ${error.message}`);
    }
  }

  private async generateResponse(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const originalMessage = context.originalMessage || '';
      const responseType = context.responseType || 'professional';
      
      const content = await this.generateResponseContent(originalMessage, responseType);
      
      this.log('info', 'Response generated', { responseType });

      return this.createResponse(message.id, 'success', {
        type: 'response',
        content,
        originalMessage,
        responseType,
        wordCount: content.split(' ').length,
        platform: 'response'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to generate response: ${error.message}`);
    }
  }

  private async generateDocument(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const docDetails = this.parseDocumentRequest(message.payload.task, context);
      
      const content = await this.generateDocumentContent(docDetails);
      
      this.log('info', 'Document generated', { 
        title: docDetails.title,
        type: docDetails.type 
      });

      return this.createResponse(message.id, 'success', {
        type: 'document',
        content,
        title: docDetails.title,
        documentType: docDetails.type,
        sections: docDetails.sections,
        wordCount: content.split(' ').length,
        platform: 'document'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to generate document: ${error.message}`);
    }
  }

  private async improveContent(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const originalContent = context.content || context.originalContent;
      const improvementType = context.improvementType || 'general';
      
      const improvedContent = await this.improveExistingContent(originalContent, improvementType);
      
      this.log('info', 'Content improved', { improvementType });

      return this.createResponse(message.id, 'success', {
        type: 'improved_content',
        original: originalContent,
        improved: improvedContent,
        improvementType,
        improvements: this.identifyImprovements(originalContent, improvedContent),
        platform: 'content'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to improve content: ${error.message}`);
    }
  }

  private async analyzeTone(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const content = context.content || message.payload.task;
      
      const analysis = await this.performToneAnalysis(content);
      
      this.log('info', 'Tone analyzed');

      return this.createResponse(message.id, 'success', {
        type: 'tone_analysis',
        content,
        analysis,
        recommendations: this.generateToneRecommendations(analysis),
        platform: 'analysis'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to analyze tone: ${error.message}`);
    }
  }

  private parseEmailRequest(task: string, context: any) {
    return {
      recipient: context.recipient || this.extractRecipient(task),
      subject: context.subject || this.extractSubject(task),
      purpose: context.purpose || this.extractPurpose(task),
      tone: context.tone || this.extractTone(task) || 'professional',
      urgency: context.urgency || this.extractUrgency(task) || 'normal'
    };
  }

  private parseLinkedInRequest(task: string, context: any) {
    return {
      topic: context.topic || this.extractTopic(task),
      tone: context.tone || this.extractTone(task) || 'professional',
      hashtags: context.hashtags || this.generateHashtags(task),
      callToAction: context.callToAction || this.extractCallToAction(task)
    };
  }

  private parseDocumentRequest(task: string, context: any) {
    return {
      title: context.title || this.extractDocumentTitle(task),
      type: context.type || this.extractDocumentType(task),
      sections: context.sections || this.extractSections(task),
      audience: context.audience || 'professional'
    };
  }

  private async generateEmailContent(details: any): Promise<string> {
    const template = this.templates.email || this.templates.default;
    
    // Apply user style preferences
    const style = this.userStyle.email || {};
    
    let content = `Subject: ${details.subject}\n\n`;
    
    // Generate greeting
    const greeting = style.formal ? 'Dear' : 'Hi';
    content += `${greeting} ${details.recipient},\n\n`;
    
    // Generate body based on purpose
    const body = await this.generateEmailBody(details.purpose, details.tone);
    content += body;
    
    // Generate closing
    const closing = style.formal ? 'Best regards' : 'Best';
    content += `\n\n${closing},\n[Your Name]`;
    
    return content;
  }

  private async generateLinkedInContent(details: any): Promise<string> {
    const hooks = [
      "Just had an amazing realization about",
      "Here's something that might change how you think about",
      "I've been reflecting on",
      "Something I learned recently:",
      "Quick thought on"
    ];
    
    const hook = hooks[Math.floor(Math.random() * hooks.length)];
    
    let content = `${hook} ${details.topic}.\n\n`;
    
    // Generate main content
    const mainContent = await this.generateLinkedInBody(details.topic, details.tone);
    content += mainContent;
    
    // Add call to action if specified
    if (details.callToAction) {
      content += `\n\n${details.callToAction}`;
    }
    
    // Add hashtags
    if (details.hashtags.length > 0) {
      content += `\n\n${details.hashtags.map(tag => `#${tag}`).join(' ')}`;
    }
    
    return content;
  }

  private async generateEmailBody(purpose: string, tone: string): Promise<string> {
    const bodies = {
      meeting: `I hope this email finds you well. I wanted to reach out to schedule a meeting to discuss our upcoming project. Would you be available sometime next week?`,
      followup: `I wanted to follow up on our previous conversation and see if you had any questions or needed additional information.`,
      introduction: `I hope you're doing well. I wanted to introduce myself and explore potential opportunities for collaboration.`,
      update: `I wanted to provide you with a quick update on the project status and next steps.`
    };
    
    return bodies[purpose] || `I hope this message finds you well. I wanted to reach out regarding ${purpose}.`;
  }

  private async generateLinkedInBody(topic: string, tone: string): Promise<string> {
    const templates = {
      professional: `In my experience, ${topic} is something that requires careful consideration and strategic thinking. Here are three key insights I've gathered:

1. [Key insight one]
2. [Key insight two]  
3. [Key insight three]

What's your experience with this? I'd love to hear your thoughts.`,
      
      casual: `So I was thinking about ${topic} today, and it got me wondering...

Have you ever noticed how this impacts our daily work? I've seen some interesting patterns lately that I think are worth sharing.

Would love to hear if you've had similar experiences!`,
      
      inspirational: `${topic} reminds me why I love what I do.

Every challenge is an opportunity to grow, learn, and make a meaningful impact. When we approach it with the right mindset, even the most complex problems become stepping stones to success.

Keep pushing forward, keep learning, and keep growing. 🚀`
    };
    
    return templates[tone] || templates.professional;
  }

  private async generateDocumentContent(details: any): Promise<string> {
    let content = `# ${details.title}\n\n`;
    
    // Add introduction
    content += `## Introduction\n\nThis document provides an overview of ${details.title.toLowerCase()} and outlines key considerations for stakeholders.\n\n`;
    
    // Add sections
    if (details.sections && details.sections.length > 0) {
      details.sections.forEach((section: string, index: number) => {
        content += `## ${index + 2}. ${section}\n\n[Content for ${section} section]\n\n`;
      });
    }
    
    // Add conclusion
    content += `## Conclusion\n\nIn summary, this document has covered the key aspects of ${details.title.toLowerCase()}. For questions or additional information, please don't hesitate to reach out.\n`;
    
    return content;
  }

  private async generateResponseContent(originalMessage: string, responseType: string): Promise<string> {
    const responses = {
      positive: `Thank you for your message! I appreciate you reaching out. `,
      professional: `Thank you for your email. I have reviewed your message and `,
      brief: `Thanks! `,
      detailed: `Thank you for taking the time to write to me. I have carefully reviewed your message and `
    };
    
    const starter = responses[responseType] || responses.professional;
    
    // Analyze original message for key points to address
    const response = starter + `I will get back to you with a detailed response shortly.`;
    
    return response;
  }

  private async improveExistingContent(content: string, improvementType: string): Promise<string> {
    // Simple improvement logic - in production, use AI APIs
    let improved = content;
    
    switch (improvementType) {
      case 'clarity':
        improved = this.improveClarityContent(content);
        break;
      case 'conciseness':
        improved = this.makeContentConcise(content);
        break;
      case 'engagement':
        improved = this.makeContentEngaging(content);
        break;
      default:
        improved = this.generalImprovement(content);
    }
    
    return improved;
  }

  private async performToneAnalysis(content: string): Promise<any> {
    // Basic tone analysis - in production, use sentiment analysis APIs
    const words = content.toLowerCase().split(/\s+/);
    
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
    const formalWords = ['furthermore', 'therefore', 'consequently', 'moreover'];
    const casualWords = ['cool', 'awesome', 'hey', 'yeah', 'totally'];
    
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    const formalCount = words.filter(word => formalWords.includes(word)).length;
    const casualCount = words.filter(word => casualWords.includes(word)).length;
    
    return {
      sentiment: positiveCount > negativeCount ? 'positive' : negativeCount > positiveCount ? 'negative' : 'neutral',
      formality: formalCount > casualCount ? 'formal' : casualCount > formalCount ? 'casual' : 'neutral',
      confidence: Math.random() * 0.3 + 0.7, // Simulate confidence score
      wordCount: words.length,
      readabilityScore: Math.floor(Math.random() * 30 + 70) // Simulate readability
    };
  }

  private initializeTemplates(): void {
    this.templates = {
      email: 'Professional email template',
      linkedin: 'LinkedIn post template',
      default: 'Default content template'
    };
  }

  // Helper extraction methods
  private extractRecipient(task: string): string {
    const match = task.match(/(?:to|email)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    return match ? match[1] : 'Recipient';
  }

  private extractSubject(task: string): string {
    const match = task.match(/subject[:\s]+([^.]+)/i);
    return match ? match[1].trim() : 'Important Message';
  }

  private extractPurpose(task: string): string {
    if (task.includes('meeting')) return 'meeting';
    if (task.includes('follow up')) return 'followup';
    if (task.includes('introduction')) return 'introduction';
    if (task.includes('update')) return 'update';
    return 'general';
  }

  private extractTone(task: string): string {
    if (task.includes('formal')) return 'professional';
    if (task.includes('casual')) return 'casual';
    if (task.includes('friendly')) return 'friendly';
    return 'professional';
  }

  private extractUrgency(task: string): string {
    if (task.includes('urgent') || task.includes('asap')) return 'high';
    if (task.includes('when you can')) return 'low';
    return 'normal';
  }

  private extractTopic(task: string): string {
    const match = task.match(/(?:about|post about|regarding)\s+([^.]+)/i);
    return match ? match[1].trim() : 'Professional Update';
  }

  private extractCallToAction(task: string): string {
    const ctas = task.match(/(?:ask|call to action|cta)[:\s]+([^.]+)/i);
    return ctas ? ctas[1].trim() : '';
  }

  private generateHashtags(task: string): string[] {
    const topicKeywords = task.toLowerCase().split(/\s+/);
    const hashtags = topicKeywords
      .filter(word => word.length > 3)
      .filter(word => !['about', 'post', 'linkedin', 'create'].includes(word))
      .slice(0, 3);
    return hashtags;
  }

  private extractDocumentTitle(task: string): string {
    const match = task.match(/(?:create|write)\s+(?:a\s+)?(.+?)\s+(?:document|report)/i);
    return match ? match[1] : 'Professional Document';
  }

  private extractDocumentType(task: string): string {
    if (task.includes('report')) return 'report';
    if (task.includes('proposal')) return 'proposal';
    if (task.includes('memo')) return 'memo';
    return 'document';
  }

  private extractSections(task: string): string[] {
    const sectionMatch = task.match(/sections?[:\s]+([^.]+)/i);
    if (sectionMatch) {
      return sectionMatch[1].split(',').map(s => s.trim());
    }
    return ['Overview', 'Details', 'Next Steps'];
  }

  // Content improvement methods
  private improveClarityContent(content: string): string {
    return content.replace(/\b(very|really|quite|somewhat)\s+/gi, '')
                 .replace(/\b(thing|stuff)\b/gi, 'item');
  }

  private makeContentConcise(content: string): string {
    return content.replace(/\b(in order to|for the purpose of)\b/gi, 'to')
                 .replace(/\b(at this point in time)\b/gi, 'now');
  }

  private makeContentEngaging(content: string): string {
    if (!content.includes('?')) {
      content += ' What do you think?';
    }
    return content;
  }

  private generalImprovement(content: string): string {
    return this.improveClarityContent(this.makeContentConcise(content));
  }

  private identifyImprovements(original: string, improved: string): string[] {
    const improvements = [];
    
    if (improved.length < original.length) {
      improvements.push('Made content more concise');
    }
    if (improved.includes('?') && !original.includes('?')) {
      improvements.push('Added engaging question');
    }
    if (improved.split('.').length > original.split('.').length) {
      improvements.push('Improved sentence structure');
    }
    
    return improvements;
  }

  private generateToneRecommendations(analysis: any): string[] {
    const recommendations = [];
    
    if (analysis.sentiment === 'negative') {
      recommendations.push('Consider using more positive language');
    }
    if (analysis.formality === 'casual' && analysis.wordCount > 200) {
      recommendations.push('For longer content, consider a more formal tone');
    }
    if (analysis.readabilityScore < 60) {
      recommendations.push('Simplify sentence structure for better readability');
    }
    
    return recommendations;
  }

  public updateUserStyle(newStyle: any): void {
    this.userStyle = { ...this.userStyle, ...newStyle };
    this.log('info', 'User style updated', newStyle);
  }
}
