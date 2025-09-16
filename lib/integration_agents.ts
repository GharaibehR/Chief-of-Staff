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

export class GoogleAgent extends BaseAgent {
  private oauth2Client: any;

  constructor(credentials: { clientId: string; clientSecret: string; redirectUri: string }) {
    super('google');
    this.oauth2Client = null;
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'schedule_meeting':
          return await this.scheduleMeeting(message);
        case 'send_email':
          return await this.sendEmail(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown action');
      }
    } catch (error) {
      this.log('error', 'Google API error', error);
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('schedule') || taskLower.includes('meeting')) {
      return 'schedule_meeting';
    }
    if (taskLower.includes('email') || taskLower.includes('send')) {
      return 'send_email';
    }
    
    return 'unknown';
  }

  private async scheduleMeeting(message: AgentMessage): Promise<AgentResponse> {
    try {
      const mockResponse = {
        eventId: `google_event_${Date.now()}`,
        meetingUrl: 'https://meet.google.com/abc-def-ghi',
        platform: 'google'
      };

      return this.createResponse(message.id, 'success', mockResponse);
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private async sendEmail(message: AgentMessage): Promise<AgentResponse> {
    try {
      const mockResponse = {
        messageId: `gmail_msg_${Date.now()}`,
        platform: 'google'
      };

      return this.createResponse(message.id, 'success', mockResponse);
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  public setAccessToken(token: string): void {
    this.log('info', 'Access token updated');
  }
}

export class MicrosoftAgent extends BaseAgent {
  private graphClient: any;

  constructor(accessToken?: string) {
    super('microsoft');
    this.graphClient = null;
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'schedule_meeting':
          return await this.scheduleMeeting(message);
        case 'send_email':
          return await this.sendEmail(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown action');
      }
    } catch (error) {
      this.log('error', 'Microsoft Graph error', error);
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('schedule') || taskLower.includes('meeting')) {
      return 'schedule_meeting';
    }
    if (taskLower.includes('email') || taskLower.includes('outlook')) {
      return 'send_email';
    }
    
    return 'unknown';
  }

  private async scheduleMeeting(message: AgentMessage): Promise<AgentResponse> {
    try {
      const mockResponse = {
        eventId: `outlook_${Date.now()}`,
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/abc123',
        platform: 'microsoft'
      };

      return this.createResponse(message.id, 'success', mockResponse);
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private async sendEmail(message: AgentMessage): Promise<AgentResponse> {
    try {
      const mockResponse = {
        platform: 'microsoft',
        status: 'sent'
      };

      return this.createResponse(message.id, 'success', mockResponse);
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  public setAccessToken(token: string): void {
    this.log('info', 'Access token updated for Microsoft Graph');
  }
}
