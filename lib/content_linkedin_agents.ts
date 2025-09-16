import { BaseAgent, AgentMessage, AgentResponse } from './chief_of_staff_core';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export class LinkedInAgent extends BaseAgent {
  private accessToken: string;

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
    
    if (taskLower.includes('post') && taskLower.includes('schedule')) {
      return 'schedule_post';
    }
    if (taskLower.includes('post')) {
      return 'create_post';
    }
    
    return 'unknown';
  }

  private async createPost(message: AgentMessage): Promise<AgentResponse> {
    try {
      const mockResponse = {
        postId: `linkedin_post_${Date.now()}`,
        platform: 'linkedin',
        status: 'published'
      };

      return this.createResponse(message.id, 'success', mockResponse);
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private async schedulePost(message: AgentMessage): Promise<AgentResponse> {
    try {
      const mockResponse = {
        scheduledPostId: `scheduled_${Date.now()}`,
        platform: 'linkedin',
        status: 'scheduled'
      };

      return this.createResponse(message.id, 'success', mockResponse);
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  public setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class ContentAgent extends BaseAgent {
  constructor() {
    super('content');
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'generate_email':
          return await this.generateEmail(message);
        case 'generate_linkedin_post':
          return await this.generateLinkedInPost(message);
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
    
    if (taskLower.includes('email')) {
      return 'generate_email';
    }
    if (taskLower.includes('linkedin') || taskLower.includes('post')) {
      return 'generate_linkedin_post';
    }
    
    return 'generate_email';
  }

  private async generateEmail(message: AgentMessage): Promise<AgentResponse> {
    try {
      const content = 'Hello! This is a generated email from your AI assistant.';
      
      return this.createResponse(message.id, 'success', {
        type: 'email',
        content,
        platform: 'email'
      });
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private async generateLinkedInPost(message: AgentMessage): Promise<AgentResponse> {
    try {
      const content = 'Excited to share some thoughts! 🚀\n\n#productivity #AI #technology';
      
      return this.createResponse(message.id, 'success', {
        type: 'linkedin_post',
        content,
        platform: 'linkedin'
      });
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }
}
