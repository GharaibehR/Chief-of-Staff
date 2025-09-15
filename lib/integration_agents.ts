import { BaseAgent, AgentMessage, AgentResponse } from './chief_of_staff_core';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

// Google Integration Agent
export class GoogleAgent extends BaseAgent {
  private oauth2Client: any;
  private calendar: any;
  private gmail: any;
  private drive: any;

  constructor(credentials: { clientId: string; clientSecret: string; redirectUri: string }) {
    super('google');
    
    this.oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'schedule_meeting':
          return await this.scheduleMeeting(message);
        case 'send_email':
          return await this.sendEmail(message);
        case 'search_calendar':
          return await this.searchCalendar(message);
        case 'create_document':
          return await this.createDocument(message);
        case 'search_drive':
          return await this.searchDrive(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown action');
      }
    } catch (error) {
      this.log('error', 'Google API error', error);
      return this.createResponse(message.id, 'error', null, error.message);
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('schedule') || taskLower.includes('meeting') || taskLower.includes('calendar')) {
      return 'schedule_meeting';
    }
    if (taskLower.includes('email') || taskLower.includes('send') || taskLower.includes('gmail')) {
      return 'send_email';
    }
    if (taskLower.includes('search calendar') || taskLower.includes('find meeting')) {
      return 'search_calendar';
    }
    if (taskLower.includes('document') || taskLower.includes('create doc')) {
      return 'create_document';
    }
    if (taskLower.includes('search drive') || taskLower.includes('find file')) {
      return 'search_drive';
    }
    
    return 'unknown';
  }

  private async scheduleMeeting(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const entities = context.entities || {};
      
      // Parse meeting details
      const meetingDetails = this.parseMeetingDetails(message.payload.task, entities);
      
      // Create calendar event
      const event = {
        summary: meetingDetails.title || 'Meeting',
        description: meetingDetails.description || '',
        start: {
          dateTime: meetingDetails.startTime,
          timeZone: 'America/Los_Angeles',
        },
        end: {
          dateTime: meetingDetails.endTime,
          timeZone: 'America/Los_Angeles',
        },
        attendees: meetingDetails.attendees.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meet_${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all'
      });

      this.log('info', 'Meeting scheduled', { eventId: response.data.id });

      return this.createResponse(message.id, 'success', {
        eventId: response.data.id,
        meetingUrl: response.data.conferenceData?.entryPoints?.[0]?.uri,
        htmlLink: response.data.htmlLink,
        attendees: response.data.attendees,
        startTime: response.data.start.dateTime,
        endTime: response.data.end.dateTime,
        platform: 'google'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to schedule meeting: ${error.message}`);
    }
  }

  private async sendEmail(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const emailDetails = this.parseEmailDetails(message.payload.task, context);

      const email = [
        `To: ${emailDetails.to}`,
        `Subject: ${emailDetails.subject}`,
        '',
        emailDetails.body
      ].join('\n');

      const encodedEmail = Buffer.from(email).toString('base64url');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedEmail
        }
      });

      this.log('info', 'Email sent', { messageId: response.data.id });

      return this.createResponse(message.id, 'success', {
        messageId: response.data.id,
        to: emailDetails.to,
        subject: emailDetails.subject,
        platform: 'google'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to send email: ${error.message}`);
    }
  }

  private async searchCalendar(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const searchTerm = context.searchTerm || 'meeting';
      
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        q: searchTerm,
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];

      return this.createResponse(message.id, 'success', {
        events: events.map(event => ({
          id: event.id,
          title: event.summary,
          startTime: event.start.dateTime || event.start.date,
          endTime: event.end.dateTime || event.end.date,
          attendees: event.attendees?.map(a => a.email) || [],
          location: event.location,
          description: event.description
        })),
        totalFound: events.length,
        platform: 'google'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to search calendar: ${error.message}`);
    }
  }

  private async createDocument(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const docDetails = this.parseDocumentDetails(message.payload.task, context);

      // Create a new Google Doc
      const response = await this.drive.files.create({
        resource: {
          name: docDetails.title,
          mimeType: 'application/vnd.google-apps.document'
        }
      });

      this.log('info', 'Document created', { fileId: response.data.id });

      return this.createResponse(message.id, 'success', {
        fileId: response.data.id,
        title: docDetails.title,
        webViewLink: `https://docs.google.com/document/d/${response.data.id}/edit`,
        platform: 'google'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to create document: ${error.message}`);
    }
  }

  private async searchDrive(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const searchTerm = context.searchTerm || context.fileName || 'document';

      const response = await this.drive.files.list({
        q: `name contains '${searchTerm}'`,
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
        pageSize: 10
      });

      const files = response.data.files || [];

      return this.createResponse(message.id, 'success', {
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          type: file.mimeType,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          size: file.size
        })),
        totalFound: files.length,
        platform: 'google'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to search drive: ${error.message}`);
    }
  }

  private parseMeetingDetails(task: string, entities: any) {
    const title = entities.title || this.extractMeetingTitle(task);
    const attendees = entities.people || this.extractAttendees(task);
    const dateTime = this.parseDateTime(entities.date, entities.time);
    
    return {
      title,
      description: `Meeting scheduled via Chief of Staff`,
      startTime: dateTime.start,
      endTime: dateTime.end,
      attendees: attendees.map(name => this.nameToEmail(name))
    };
  }

  private parseEmailDetails(task: string, context: any) {
    return {
      to: context.recipient || this.extractEmailRecipient(task),
      subject: context.subject || this.extractEmailSubject(task),
      body: context.body || context.previousResult?.content || 'Email sent via Chief of Staff'
    };
  }

  private parseDocumentDetails(task: string, context: any) {
    return {
      title: context.title || this.extractDocumentTitle(task),
      content: context.content || context.previousResult?.content || ''
    };
  }

  private extractMeetingTitle(task: string): string {
    const match = task.match(/schedule\s+(?:a\s+)?(.+?)\s+(?:with|for|on)/i);
    return match ? match[1] : 'Meeting';
  }

  private extractAttendees(task: string): string[] {
    const names = task.match(/\b[A-Z][a-z]+(?:\s+
