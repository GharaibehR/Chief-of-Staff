import { BaseAgent, AgentMessage, AgentResponse } from './chief_of_staff_core';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export class TaskAgent extends BaseAgent {
  private tasks: Map<string, Task> = new Map();

  constructor() {
    super('task');
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'create_task':
          return await this.createTask(message);
        case 'list_tasks':
          return await this.listTasks(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown task action');
      }
    } catch (error) {
      this.log('error', 'Task management error', error);
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('create') && taskLower.includes('task')) {
      return 'create_task';
    }
    if (taskLower.includes('list') || taskLower.includes('show tasks')) {
      return 'list_tasks';
    }
    
    return 'create_task';
  }

  private async createTask(message: AgentMessage): Promise<AgentResponse> {
    try {
      const taskDetails = this.parseTaskDetails(message.payload.task);
      
      const task: Task = {
        id: `task_${Date.now()}`,
        title: taskDetails.title,
        description: taskDetails.description,
        status: 'pending',
        priority: taskDetails.priority,
        dueDate: taskDetails.dueDate,
        category: taskDetails.category,
        tags: taskDetails.tags,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.tasks.set(task.id, task);
      
      this.log('info', 'Task created', { taskId: task.id, title: task.title });

      return this.createResponse(message.id, 'success', {
        task,
        message: `Task "${task.title}" created successfully`,
        taskId: task.id
      });
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private async listTasks(message: AgentMessage): Promise<AgentResponse> {
    try {
      const tasksArray = Array.from(this.tasks.values());
      
      return this.createResponse(message.id, 'success', {
        tasks: tasksArray,
        totalCount: tasksArray.length
      });
    } catch (error) {
      return this.createResponse(message.id, 'error', null, getErrorMessage(error));
    }
  }

  private parseTaskDetails(task: string): Record<string, any> {
    return {
      title: this.extractTitle(task),
      description: this.extractDescription(task),
      priority: this.extractPriority(task) || 'medium',
      dueDate: this.extractDueDate(task),
      category: this.extractCategory(task) || 'general',
      tags: this.extractTags(task)
    };
  }

  private extractTitle(task: string): string {
    const match = task.match(/(?:create|add|new)\s+(?:task\s+)?(?:for\s+)?["']?([^"']+)["']?/i);
    return match ? match[1].trim() : task.split(' ').slice(0, 5).join(' ');
  }

  private extractDescription(task: string): string {
    const match = task.match(/description[:\s]+([^.]+)/i);
    return match ? match[1].trim() : '';
  }

  private extractPriority(task: string): 'low' | 'medium' | 'high' | 'urgent' | null {
    if (task.includes('urgent')) return 'urgent';
    if (task.includes('high')) return 'high';
    if (task.includes('low')) return 'low';
    return 'medium';
  }

  private extractDueDate(task: string): Date | null {
    const dateMatch = task.match(/(?:due|by|before)\s+([^.]+)/i);
    if (dateMatch) {
      const dateStr = dateMatch[1].trim();
      if (dateStr.includes('today')) return new Date();
      if (dateStr.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
    }
    return null;
  }

  private extractCategory(task: string): string {
    const categories = ['work', 'personal', 'project', 'meeting'];
    const taskLower = task.toLowerCase();
    
    for (const category of categories) {
      if (taskLower.includes(category)) return category;
    }
    return 'general';
  }

  private extractTags(task: string): string[] {
    const tagMatch = task.match(/tags?[:\s]+([^.]+)/i);
    if (tagMatch) {
      return tagMatch[1].split(',').map((tag: string) => tag.trim());
    }
    return [];
  }

  public getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
}
