import { BaseAgent, AgentMessage, AgentResponse } from './chief_of_staff_core';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

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
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
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
      
      // Simplified implementation for demo
      const mockResponse = {
        postId: `linkedin_post_${Date.now()}`,
        content: postContent,
        visibility: 'PUBLIC',
        platform: 'linkedin',
        status: 'published',
        timestamp: new Date().toISOString()
      };

      this.log('info', 'LinkedIn post created', { postId: mockResponse.postId });

      return this.createResponse(message.id, 'success', mockResponse);

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to create LinkedIn post: ${getErrorMessage(error)}`);
    }
  }

  private async schedulePost(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const postContent = context.content || context.previousResult?.content || message.payload.task;
      const scheduledTime = this.parseScheduleTime(message.payload.task, context);

      // For demo purposes, we'll create a mock scheduled post
      const scheduledPost = {
        id: `scheduled_${Date.now()}`,
        content: postContent,
        scheduledFor: scheduledTime,
        status: 'scheduled',
        platform: 'linkedin',
        created: new Date().toISOString()
      };

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
      return this.createResponse(message.id, 'error', null, `Failed to schedule LinkedIn post: ${getErrorMessage(error)}`);
    }
  }

  private async sendMessage(message: AgentMessage): Promise<AgentResponse> {
    try {
      // Simplified implementation for demo
      const mockResponse = {
        conversationId: `linkedin_conv_${Date.now()}`,
        recipient: 'Professional Contact',
        subject: 'Message from Chief of Staff',
        content: 'Hello! This message was sent via Chief of Staff.',
        platform: 'linkedin',
        status: 'sent'
      };

      this.log('info', 'LinkedIn message sent', { conversationId: mockResponse.conversationId });

      return this.createResponse(message.id, 'success', mockResponse);

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to send LinkedIn message: ${getErrorMessage(error)}`);
    }
  }

  private async searchConnections(message: AgentMessage): Promise<AgentResponse> {
    try {
      // Simplified implementation for demo
      const mockConnections = [
        {
          id: 'connection1',
          name: 'John Smith',
          headline: 'Software Engineer at Tech Corp',
          location: 'San Francisco Bay Area',
          industry: 'Technology',
          profileUrl: 'https://linkedin.com/in/johnsmith'
        },
        {
          id: 'connection2',
          name: 'Sarah Johnson',
          headline: 'Product Manager at Innovation Inc',
          location: 'New York',
          industry: 'Technology',
          profileUrl: 'https://linkedin.com/in/sarahjohnson'
        }
      ];

      return this.createResponse(message.id, 'success', {
        connections: mockConnections,
        totalFound: mockConnections.length,
        searchTerm: 'connections',
        platform: 'linkedin'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to search connections: ${getErrorMessage(error)}`);
    }
  }

  private async getProfile(message: AgentMessage): Promise<AgentResponse> {
    try {
      // Simplified implementation for demo
      const mockProfile = {
        id: 'current_user',
        name: 'Demo User',
        headline: 'AI Enthusiast | Productivity Expert',
        summary: 'Passionate about leveraging AI to improve productivity and efficiency.',
        location: 'San Francisco Bay Area',
        industry: 'Technology',
        profileUrl: 'https://linkedin.com/in/demouser'
      };

      return this.createResponse(message.id, 'success', {
        profile: mockProfile,
        platform: 'linkedin'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to get profile: ${getErrorMessage(error)}`);
    }
  }

  private async analyzeNetwork(message: AgentMessage): Promise<AgentResponse> {
    try {
      // Simplified implementation for demo
      const analysis = {
        totalConnections: 500,
        industries: {
          'Technology': 150,
          'Finance': 75,
          'Healthcare': 50,
          'Education': 40,
          'Consulting': 35
        },
        locations: {
          'San Francisco Bay Area': 100,
          'New York': 75,
          'Los Angeles': 50,
          'Chicago': 40,
          'Boston': 35
        },
        topCompanies: {
          'Google': 25,
          'Microsoft': 20,
          'Apple': 18,
          'Meta': 15,
          'Amazon': 12
        },
        recommendations: [
          'Your network is strong in Technology - consider diversifying to other industries',
          'Engage more with connections through posts and comments',
          'Share industry insights to increase visibility'
        ]
      };

      return this.createResponse(message.id, 'success', {
        networkAnalysis: analysis,
        platform: 'linkedin',
        analyzedAt: new Date().toISOString()
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to analyze network: ${getErrorMessage(error)}`);
    }
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
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
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
      return this.createResponse(message.id, 'error', null, `Failed to generate email: ${getErrorMessage(error)}`);
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
      return this.createResponse(message.id, 'error', null, `Failed to generate LinkedIn post: ${getErrorMessage(error)}`);
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
      return this.createResponse(message.id, 'error', null, `Failed to generate response: ${getErrorMessage(error)}`);
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
      return this.createResponse(message.id, 'error', null, `Failed to generate document: ${getErrorMessage(error)}`);
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
      return this.createResponse(message.id, 'error', null, `Failed to improve content: ${getErrorMessage(error)}`);
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
      return this.createResponse(message.id, 'error', null, `Failed to analyze tone: ${getErrorMessage(error)}`);
    }
  }

  // Helper methods with simplified implementations
  private parseEmailRequest(task: string, context: any) {
    return {
      recipient: context.recipient || 'recipient@example.com',
      subject: context.subject || 'Message from Chief of Staff',
      purpose: context.purpose || 'general',
      tone: context.tone || 'professional',
      urgency: context.urgency || 'normal'
    };
  }

  private parseLinkedInRequest(task: string, context: any) {
    return {
      topic: context.topic || 'Professional Update',
      tone: context.tone || 'professional',
      hashtags: context.hashtags || ['productivity', 'AI', 'technology'],
      callToAction: context.callToAction || ''
    };
  }

  private parseDocumentRequest(task: string, context: any) {
    return {
      title: context.title || 'Professional Document',
      type: context.type || 'document',
      sections: context.sections || ['Introduction', 'Main Content', 'Conclusion'],
      audience: context.audience || 'professional'
    };
  }

  private async generateEmailContent(details: any): Promise<string> {
    return `Subject: ${details.subject}

Dear ${details.recipient},

I hope this email finds you well. I wanted to reach out regarding our upcoming project collaboration.

Thank you for your time and consideration.

Best regards,
Your AI Assistant`;
  }

  private async generateLinkedInContent(details: any): Promise<string> {
    return `Excited to share some thoughts on ${details.topic}! 🚀

In today's fast-paced world, leveraging AI and technology has become essential for staying competitive and efficient.

What are your thoughts on this topic? I'd love to hear your experiences!

${details.hashtags.map(tag => `#${tag}`).join(' ')}`;
  }

  private async generateResponseContent(originalMessage: string, responseType: string): Promise<string> {
    return `Thank you for your message! I appreciate you reaching out. I'll review your request and get back to you with a detailed response shortly.`;
  }

  private async generateDocumentContent(details: any): Promise<string> {
    return `# ${details.title}

## Introduction
This document provides an overview of ${details.title.toLowerCase()} and outlines key considerations for stakeholders.

## Main Content
[Content sections would be expanded based on specific requirements]

## Conclusion
In summary, this document has covered the key aspects of ${details.title.toLowerCase()}. For questions or additional information, please don't hesitate to reach out.`;
  }

  private async improveExistingContent(content: string, improvementType: string): Promise<string> {
    // Simple improvement - in production, use AI APIs
    return content.replace(/\b(very|really|quite|somewhat)\s+/gi, '')
                 .replace(/\b(thing|stuff)\b/gi, 'item');
  }

  private async performToneAnalysis(content: string): Promise<any> {
    // Basic tone analysis - in production, use sentiment analysis APIs
    return {
      sentiment: 'neutral',
      formality: 'professional',
      confidence: 0.85,
      wordCount: content.split(' ').length,
      readabilityScore: 75
    };
  }

  private initializeTemplates(): void {
    this.templates = {
      email: 'Professional email template',
      linkedin: 'LinkedIn post template',
      default: 'Default content template'
    };
  }

  private identifyImprovements(original: string, improved: string): string[] {
    const improvements = [];
    
    if (improved.length < original.length) {
      improvements.push('Made content more concise');
    }
    if (improved.includes('?') && !original.includes('?')) {
      improvements.push('Added engaging question');
    }
    
    return improvements;
  }

  private generateToneRecommendations(analysis: any): string[] {
    const recommendations = [];
    
    if (analysis.sentiment === 'negative') {
      recommendations.push('Consider using more positive language');
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
