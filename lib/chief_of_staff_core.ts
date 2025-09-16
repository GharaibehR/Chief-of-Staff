// Core Types and Interfaces
export type AgentType = 'chief' | 'interpreter' | 'google' | 'microsoft' | 'linkedin' | 'content' | 'qa' | 'task';

export interface AgentMessage {
  id: string;
  from: AgentType;
  to: AgentType;
  timestamp: Date;
  payload: {
    task: string;
    context: Record<string, any>;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    validation_required: boolean;
  };
  metadata: {
    user_id: string;
    session_id: string;
    conversation_id: string;
  };
}

export interface AgentResponse {
  id: string;
  status: 'success' | 'error' | 'pending' | 'requires_input';
  data?: any;
  error?: string;
  next_agent?: AgentType;
  validation_passed?: boolean;
  processing_time?: number;
}

export interface UserIntent {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  platforms: string[];
  complexity: 'low' | 'medium' | 'high';
}

export interface ValidationResult {
  passed: boolean;
  issues: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }>;
  recommendations: string[];
}

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

// Base Agent Class
export abstract class BaseAgent {
  protected agentType: AgentType;
  protected config: Record<string, any>;

  constructor(agentType: AgentType, config: Record<string, any> = {}) {
    this.agentType = agentType;
    this.config = config;
  }

  abstract process(message: AgentMessage): Promise<AgentResponse>;

  protected createResponse(
    messageId: string,
    status: AgentResponse['status'],
    data?: any,
    error?: string
  ): AgentResponse {
    return {
      id: `${this.agentType}_${Date.now()}`,
      status,
      data,
      error,
      processing_time: Date.now()
    };
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    console.log(`[${this.agentType.toUpperCase()}] ${level.toUpperCase()}: ${message}`, data || '');
  }
}

// A Agent - Input Interpreter
export class InterpreterAgent extends BaseAgent {
  constructor() {
    super('interpreter');
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const userInput = message.payload.context.userInput;
      this.log('info', 'Processing user input', { input: userInput });

      const intent = await this.parseIntent(userInput);
      const entities = await this.extractEntities(userInput);
      const platforms = this.identifyPlatforms(userInput);
      const complexity = this.assessComplexity(intent, entities, platforms);

      const result: UserIntent = {
        intent: intent.name,
        entities,
        confidence: intent.confidence,
        platforms,
        complexity
      };

      return this.createResponse(message.id, 'success', result);
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private async parseIntent(input: string): Promise<{ name: string; confidence: number }> {
    // Intent classification logic
    const intents = [
      { pattern: /schedule|meeting|calendar|appointment/i, name: 'schedule_meeting', weight: 0.9 },
      { pattern: /email|send|draft|compose/i, name: 'email_action', weight: 0.8 },
      { pattern: /linkedin|post|share|network/i, name: 'linkedin_action', weight: 0.8 },
      { pattern: /task|todo|remind|deadline/i, name: 'task_management', weight: 0.7 },
      { pattern: /search|find|look/i, name: 'search_action', weight: 0.6 },
      { pattern: /create|make|generate/i, name: 'content_creation', weight: 0.7 }
    ];

    for (const intent of intents) {
      if (intent.pattern.test(input)) {
        return { name: intent.name, confidence: intent.weight };
      }
    }

    return { name: 'general_query', confidence: 0.5 };
  }

  private async extractEntities(input: string): Promise<Record<string, any>> {
    const entities: Record<string, any> = {};

    // Extract dates/times
    const dateMatch = input.match(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})\b/gi);
    if (dateMatch) entities.date = dateMatch[0];

    const timeMatch = input.match(/\b(\d{1,2}:\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm))\b/gi);
    if (timeMatch) entities.time = timeMatch[0];

    // Extract names/people
    const nameMatch = input.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);
    if (nameMatch) entities.people = nameMatch;

    // Extract platforms
    const platforms = ['google', 'outlook', 'teams', 'linkedin', 'gmail', 'calendar'];
    entities.platforms = platforms.filter(platform => 
      input.toLowerCase().includes(platform)
    );

    return entities;
  }

  private identifyPlatforms(input: string): string[] {
    const platformKeywords = {
      google: ['google', 'gmail', 'gcal', 'google calendar', 'google meet'],
      microsoft: ['outlook', 'teams', 'microsoft', 'onedrive', 'sharepoint'],
      linkedin: ['linkedin', 'professional network', 'connections']
    };

    const platforms: string[] = [];
    const lowerInput = input.toLowerCase();

    for (const [platform, keywords] of Object.entries(platformKeywords)) {
      if (keywords.some(keyword => lowerInput.includes(keyword))) {
        platforms.push(platform);
      }
    }

    return platforms;
  }

  private assessComplexity(intent: { name: string }, entities: Record<string, any>, platforms: string[]): 'low' | 'medium' | 'high' {
    let complexity = 0;

    // Multi-platform operations increase complexity
    if (platforms.length > 1) complexity += 2;
    
    // Multiple people involved
    if (entities.people && entities.people.length > 2) complexity += 1;
    
    // Complex intents
    if (['schedule_meeting', 'content_creation'].includes(intent.name)) complexity += 1;
    
    // Time-sensitive operations
    if (entities.date || entities.time) complexity += 1;

    if (complexity >= 3) return 'high';
    if (complexity >= 1) return 'medium';
    return 'low';
  }
}

// Q Agent - Quality Assurance
export class QualityAgent extends BaseAgent {
  constructor() {
    super('qa');
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const dataToValidate = message.payload.context.data;
      const sourceAgent = message.payload.context.sourceAgent;

      this.log('info', 'Validating output', { sourceAgent, dataType: typeof dataToValidate });

      const validation = await this.validateOutput(dataToValidate, sourceAgent);
      
      return this.createResponse(message.id, 'success', {
        validation_passed: validation.passed,
        validation_result: validation,
        approved_data: validation.passed ? dataToValidate : null
      });
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private async validateOutput(data: any, sourceAgent: string): Promise<ValidationResult> {
    const issues: ValidationResult['issues'] = [];
    const recommendations: string[] = [];

    // Data structure validation
    if (!data || typeof data !== 'object') {
      issues.push({
        type: 'structure',
        message: 'Invalid data structure received',
        severity: 'high'
      });
    }

    // Content safety validation
    if (typeof data === 'object' && data.content) {
      const safetyCheck = await this.checkContentSafety(data.content);
      if (!safetyCheck.safe) {
        issues.push({
          type: 'safety',
          message: `Content safety issue: ${safetyCheck.reason}`,
          severity: 'high'
        });
      }
    }

    // Platform-specific validation
    if (sourceAgent === 'linkedin' && data.post) {
      if (data.post.length > 3000) {
        issues.push({
          type: 'platform_limit',
          message: 'LinkedIn post exceeds character limit',
          severity: 'medium'
        });
        recommendations.push('Trim content to under 3000 characters');
      }
    }

    // Time validation for scheduling
    if (data.datetime) {
      const scheduledTime = new Date(data.datetime);
      const now = new Date();
      
      if (scheduledTime < now) {
        issues.push({
          type: 'temporal',
          message: 'Scheduled time is in the past',
          severity: 'high'
        });
      }
    }

    return {
      passed: issues.filter(i => i.severity === 'high').length === 0,
      issues,
      recommendations
    };
  }

  private async checkContentSafety(content: string): Promise<{ safe: boolean; reason?: string }> {
    // Basic content safety checks
    const dangerousPatterns = [
      /\b(password|confidential|secret|private key)\b/i,
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      /\b\d{16}\b/, // Credit card pattern
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return { safe: false, reason: 'Potentially sensitive information detected' };
      }
    }

    return { safe: true };
  }
}

// Chief of Staff - Central Orchestrator
export class ChiefOfStaffAgent extends BaseAgent {
  private agents: Map<AgentType, BaseAgent>;
  private conversationHistory: Map<string, AgentMessage[]>;

  constructor() {
    super('chief');
    this.agents = new Map();
    this.conversationHistory = new Map();
    
    // Initialize agents
    this.agents.set('interpreter', new InterpreterAgent());
    this.agents.set('qa', new QualityAgent());
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      this.log('info', 'Processing user request', { task: message.payload.task });

      // Step 1: Interpret user input
      const interpretedResponse = await this.delegateToAgent('interpreter', {
        ...message,
        payload: {
          ...message.payload,
          context: { userInput: message.payload.task }
        }
      });

      if (interpretedResponse.status !== 'success') {
        return this.createResponse(message.id, 'error', null, 'Failed to interpret user input');
      }

      const userIntent: UserIntent = interpretedResponse.data;
      this.log('info', 'User intent identified', userIntent);

      // Step 2: Route to appropriate agent(s)
      const executionPlan = this.createExecutionPlan(userIntent);
      const results = await this.executeWorkflow(executionPlan, message);

      // Step 3: Validate results
      const validatedResults = await this.validateResults(results);

      // Step 4: Compose final response
      const finalResponse = this.composeFinalResponse(validatedResults, userIntent);

      return this.createResponse(message.id, 'success', finalResponse);
    } catch (error) {
      this.log('error', 'Processing failed', error);
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private createExecutionPlan(intent: UserIntent): { agents: AgentType[]; parallel: boolean } {
    const plans: Record<string, { agents: AgentType[]; parallel: boolean }> = {
      'schedule_meeting': {
        agents: intent.platforms.includes('google') && intent.platforms.includes('microsoft') 
          ? ['google', 'microsoft'] 
          : intent.platforms.includes('google') ? ['google'] : ['microsoft'],
        parallel: true
      },
      'email_action': {
        agents: ['content', intent.platforms.includes('google') ? 'google' : 'microsoft'],
        parallel: false
      },
      'linkedin_action': {
        agents: ['content', 'linkedin'],
        parallel: false
      },
      'task_management': {
        agents: ['task'],
        parallel: false
      },
      'content_creation': {
        agents: ['content'],
        parallel: false
      }
    };

    return plans[intent.intent] || { agents: ['content'], parallel: false };
  }

  private async executeWorkflow(
    plan: { agents: AgentType[]; parallel: boolean },
    originalMessage: AgentMessage
  ): Promise<AgentResponse[]> {
    if (plan.parallel) {
      const promises = plan.agents.map(agentType => 
        this.delegateToAgent(agentType, originalMessage)
      );
      return Promise.all(promises);
    } else {
      const results: AgentResponse[] = [];
      let currentContext = originalMessage.payload.context;

      for (const agentType of plan.agents) {
        const response = await this.delegateToAgent(agentType, {
          ...originalMessage,
          payload: { ...originalMessage.payload, context: currentContext }
        });
        
        results.push(response);
        
        // Pass successful results to next agent
        if (response.status === 'success' && response.data) {
          currentContext = { ...currentContext, previousResult: response.data };
        }
      }

      return results;
    }
  }

  private async delegateToAgent(agentType: AgentType, message: AgentMessage): Promise<AgentResponse> {
    const agent = this.agents.get(agentType);
    
    if (!agent) {
      return this.createResponse(message.id, 'error', null, `Agent ${agentType} not found`);
    }

    const startTime = Date.now();
    const response = await agent.process(message);
    response.processing_time = Date.now() - startTime;

    this.log('info', `Agent ${agentType} completed`, { 
      status: response.status, 
      processingTime: response.processing_time 
    });

    return response;
  }

  private async validateResults(results: AgentResponse[]): Promise<AgentResponse[]> {
    const validatedResults: AgentResponse[] = [];

    for (const result of results) {
      if (result.status === 'success' && result.data) {
        const validationMessage: AgentMessage = {
          id: `validation_${Date.now()}`,
          from: 'chief',
          to: 'qa',
          timestamp: new Date(),
          payload: {
            task: 'validate_output',
            context: { 
              data: result.data,
              sourceAgent: 'unknown' // Should be tracked better
            },
            priority: 'medium',
            validation_required: true
          },
          metadata: {
            user_id: 'current_user',
            session_id: 'current_session',
            conversation_id: 'current_conversation'
          }
        };

        const validationResult = await this.delegateToAgent('qa', validationMessage);
        
        if (validationResult.status === 'success' && validationResult.data.validation_passed) {
          validatedResults.push({
            ...result,
            validation_passed: true,
            data: validationResult.data.approved_data
          });
        } else {
          validatedResults.push({
            ...result,
            status: 'error',
            error: 'Validation failed',
            validation_passed: false
          });
        }
      } else {
        validatedResults.push(result);
      }
    }

    return validatedResults;
  }

  private composeFinalResponse(results: AgentResponse[], intent: UserIntent): any {
    const successfulResults = results.filter(r => r.status === 'success');
    const errors = results.filter(r => r.status === 'error');

    if (errors.length > 0) {
      return {
        success: false,
        message: `Some operations failed: ${errors.map(e => e.error).join(', ')}`,
        partial_results: successfulResults.map(r => r.data),
        intent: intent.intent
      };
    }

    return {
      success: true,
      message: this.generateSuccessMessage(intent.intent, successfulResults),
      results: successfulResults.map(r => r.data),
      intent: intent.intent,
      processing_summary: {
        total_agents: results.length,
        total_time: results.reduce((sum, r) => sum + (r.processing_time || 0), 0),
        complexity: intent.complexity
      }
    };
  }

  private generateSuccessMessage(intent: string, results: AgentResponse[]): string {
    const messages: Record<string, string> = {
      'schedule_meeting': 'Meeting successfully scheduled across all platforms',
      'email_action': 'Email drafted and sent successfully',
      'linkedin_action': 'LinkedIn post created and scheduled',
      'task_management': 'Task created and organized',
      'content_creation': 'Content generated successfully'
    };

    return messages[intent] || 'Task completed successfully';
  }

  // Public methods for external integration
  public addAgent(agentType: AgentType, agent: BaseAgent): void {
    this.agents.set(agentType, agent);
    this.log('info', `Agent ${agentType} registered`);
  }

  public getConversationHistory(conversationId: string): AgentMessage[] {
    return this.conversationHistory.get(conversationId) || [];
  }
}

// Usage Example and Testing
export class ChiefOfStaffSystem {
  private chiefOfStaff: ChiefOfStaffAgent;

  constructor() {
    this.chiefOfStaff = new ChiefOfStaffAgent();
  }

  async processUserRequest(userInput: string, userId: string): Promise<any> {
    const message: AgentMessage = {
      id: `msg_${Date.now()}`,
      from: 'chief',
      to: 'interpreter',
      timestamp: new Date(),
      payload: {
        task: userInput,
        context: {},
        priority: 'medium',
        validation_required: true
      },
      metadata: {
        user_id: userId,
        session_id: `session_${Date.now()}`,
        conversation_id: `conv_${Date.now()}`
      }
    };

    return await this.chiefOfStaff.process(message);
  }
}
