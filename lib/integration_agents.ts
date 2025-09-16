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
    const names = task.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    return names.filter(name => !['Google', 'Calendar', 'Meeting', 'Schedule'].includes(name));
  }

  private extractEmailRecipient(task: string): string {
    const emailMatch = task.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) return emailMatch[0];
    
    const nameMatch = task.match(/(?:to|send)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    return nameMatch ? this.nameToEmail(nameMatch[1]) : 'user@example.com';
  }

  private extractEmailSubject(task: string): string {
    const subjectMatch = task.match(/subject[:\s]+([^.]+)/i);
    return subjectMatch ? subjectMatch[1].trim() : 'Message from Chief of Staff';
  }

  private extractDocumentTitle(task: string): string {
    const titleMatch = task.match(/create\s+(?:a\s+)?(.+?)\s+document/i);
    return titleMatch ? titleMatch[1] : `Document ${new Date().toLocaleDateString()}`;
  }

  private parseDateTime(date?: string, time?: string) {
    const now = new Date();
    let startTime = new Date(now);
    
    // Parse date
    if (date) {
      if (date.toLowerCase() === 'today') {
        // Keep current date
      } else if (date.toLowerCase() === 'tomorrow') {
        startTime.setDate(startTime.getDate() + 1);
      } else if (date.toLowerCase().includes('next week')) {
        startTime.setDate(startTime.getDate() + 7);
      } else {
        // Try to parse as date
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          startTime = parsedDate;
        }
      }
    }

    // Parse time
    if (time) {
      const timeMatch = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');
        const period = timeMatch[3]?.toLowerCase();

        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;

        startTime.setHours(hours, minutes, 0, 0);
      }
    } else {
      // Default to next available hour
      startTime.setHours(startTime.getHours() + 1, 0, 0, 0);
    }

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // 1-hour meeting

    return {
      start: startTime.toISOString(),
      end: endTime.toISOString()
    };
  }

  private nameToEmail(name: string): string {
    // Simple name to email conversion (in real app, use contacts API)
    return `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
  }

  public setAccessToken(token: string): void {
    this.oauth2Client.setCredentials({ access_token: token });
  }
}

// Microsoft Integration Agent
export class MicrosoftAgent extends BaseAgent {
  private graphClient: Client;

  constructor(accessToken?: string) {
    super('microsoft');
    
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
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
        case 'create_teams_meeting':
          return await this.createTeamsMeeting(message);
        case 'search_onedrive':
          return await this.searchOneDrive(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown action');
      }
    } catch (error) {
      this.log('error', 'Microsoft Graph error', error);
      return this.createResponse(message.id, 'error', null, error.message);
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('teams meeting') || taskLower.includes('teams call')) {
      return 'create_teams_meeting';
    }
    if (taskLower.includes('schedule') || taskLower.includes('meeting') || taskLower.includes('calendar')) {
      return 'schedule_meeting';
    }
    if (taskLower.includes('email') || taskLower.includes('outlook')) {
      return 'send_email';
    }
    if (taskLower.includes('search calendar') || taskLower.includes('find meeting')) {
      return 'search_calendar';
    }
    if (taskLower.includes('onedrive') || taskLower.includes('search files')) {
      return 'search_onedrive';
    }
    
    return 'unknown';
  }

  private async scheduleMeeting(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const entities = context.entities || {};
      
      const meetingDetails = this.parseMeetingDetails(message.payload.task, entities);
      
      const event = {
        subject: meetingDetails.title,
        body: {
          contentType: 'HTML',
          content: meetingDetails.description
        },
        start: {
          dateTime: meetingDetails.startTime,
          timeZone: 'Pacific Standard Time'
        },
        end: {
          dateTime: meetingDetails.endTime,
          timeZone: 'Pacific Standard Time'
        },
        attendees: meetingDetails.attendees.map(email => ({
          emailAddress: {
            address: email,
            name: email.split('@')[0]
          }
        })),
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness'
      };

      const response = await this.graphClient.api('/me/events').post(event);

      this.log('info', 'Meeting scheduled', { eventId: response.id });

      return this.createResponse(message.id, 'success', {
        eventId: response.id,
        meetingUrl: response.onlineMeeting?.joinUrl,
        webLink: response.webLink,
        attendees: response.attendees,
        startTime: response.start.dateTime,
        endTime: response.end.dateTime,
        platform: 'microsoft'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to schedule meeting: ${error.message}`);
    }
  }

  private async sendEmail(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const emailDetails = this.parseEmailDetails(message.payload.task, context);

      const email = {
        message: {
          subject: emailDetails.subject,
          body: {
            contentType: 'HTML',
            content: emailDetails.body
          },
          toRecipients: [
            {
              emailAddress: {
                address: emailDetails.to
              }
            }
          ]
        }
      };

      const response = await this.graphClient.api('/me/sendMail').post(email);

      this.log('info', 'Email sent via Outlook');

      return this.createResponse(message.id, 'success', {
        to: emailDetails.to,
        subject: emailDetails.subject,
        platform: 'microsoft',
        status: 'sent'
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
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await this.graphClient
        .api('/me/events')
        .filter(`contains(subject,'${searchTerm}')`)
        .select('id,subject,start,end,attendees,location,bodyPreview')
        .top(10)
        .get();

      const events = response.value || [];

      return this.createResponse(message.id, 'success', {
        events: events.map(event => ({
          id: event.id,
          title: event.subject,
          startTime: event.start.dateTime,
          endTime: event.end.dateTime,
          attendees: event.attendees?.map(a => a.emailAddress.address) || [],
          location: event.location?.displayName,
          description: event.bodyPreview
        })),
        totalFound: events.length,
        platform: 'microsoft'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to search calendar: ${error.message}`);
    }
  }

  private async createTeamsMeeting(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const entities = context.entities || {};
      
      const meetingDetails = this.parseMeetingDetails(message.payload.task, entities);
      
      const onlineMeeting = {
        startDateTime: meetingDetails.startTime,
        endDateTime: meetingDetails.endTime,
        subject: meetingDetails.title
      };

      const response = await this.graphClient.api('/me/onlineMeetings').post(onlineMeeting);

      this.log('info', 'Teams meeting created', { meetingId: response.id });

      return this.createResponse(message.id, 'success', {
        meetingId: response.id,
        joinUrl: response.joinWebUrl,
        conferenceId: response.audioConferencing?.conferenceId,
        startTime: response.startDateTime,
        endTime: response.endDateTime,
        platform: 'microsoft',
        type: 'teams'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to create Teams meeting: ${error.message}`);
    }
  }

  private async searchOneDrive(message: AgentMessage): Promise<AgentResponse> {
    try {
      const context = message.payload.context;
      const searchTerm = context.searchTerm || context.fileName || 'document';

      const response = await this.graphClient
        .api('/me/drive/search(q=\'{searchTerm}\')')
        .select('id,name,size,lastModifiedDateTime,webUrl,file')
        .top(10)
        .get();

      const files = response.value || [];

      return this.createResponse(message.id, 'success', {
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          size: file.size,
          modifiedTime: file.lastModifiedDateTime,
          webUrl: file.webUrl,
          type: file.file?.mimeType || 'unknown'
        })),
        totalFound: files.length,
        platform: 'microsoft'
      });

    } catch (error) {
      return this.createResponse(message.id, 'error', null, `Failed to search OneDrive: ${error.message}`);
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

  private extractMeetingTitle(task: string): string {
    const match = task.match(/schedule\s+(?:a\s+)?(.+?)\s+(?:with|for|on)/i);
    return match ? match[1] : 'Meeting';
  }

  private extractAttendees(task: string): string[] {
    const names = task.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    return names.filter(name => !['Microsoft', 'Teams', 'Outlook', 'Meeting', 'Schedule'].includes(name));
  }

  private extractEmailRecipient(task: string): string {
    const emailMatch = task.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) return emailMatch[0];
    
    const nameMatch = task.match(/(?:to|send)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    return nameMatch ? this.nameToEmail(nameMatch[1]) : 'user@company.com';
  }

  private extractEmailSubject(task: string): string {
    const subjectMatch = task.match(/subject[:\s]+([^.]+)/i);
    return subjectMatch ? subjectMatch[1].trim() : 'Message from Chief of Staff';
  }

  private parseDateTime(date?: string, time?: string) {
    const now = new Date();
    let startTime = new Date(now);
    
    // Parse date
    if (date) {
      if (date.toLowerCase() === 'today') {
        // Keep current date
      } else if (date.toLowerCase() === 'tomorrow') {
        startTime.setDate(startTime.getDate() + 1);
      } else if (date.toLowerCase().includes('next week')) {
        startTime.setDate(startTime.getDate() + 7);
      } else {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          startTime = parsedDate;
        }
      }
    }

    // Parse time
    if (time) {
      const timeMatch = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');
        const period = timeMatch[3]?.toLowerCase();

        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;

        startTime.setHours(hours, minutes, 0, 0);
      }
    } else {
      startTime.setHours(startTime.getHours() + 1, 0, 0, 0);
    }

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    return {
      start: startTime.toISOString(),
      end: endTime.toISOString()
    };
  }

  private nameToEmail(name: string): string {
    return `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
  }

  public setAccessToken(token: string): void {
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, token);
      }
    });
  }
}
