import { BaseAgent, AgentMessage, AgentResponse } from './chief_of_staff_core';

// Task Management Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  category: string;
  tags: string[];
  assignedTo?: string;
  projectId?: string;
  subtasks: Subtask[];
  recurrence?: RecurrenceRule;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'on_hold';
  members: string[];
  tasks: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  count?: number;
}

// Task Management Agent
export class TaskAgent extends BaseAgent {
  private tasks: Map<string, Task> = new Map();
  private projects: Map<string, Project> = new Map();

  constructor() {
    super('task');
  }

  async process(message: AgentMessage): Promise<AgentResponse> {
    try {
      const action = this.determineAction(message.payload.task);
      
      switch (action) {
        case 'create_task':
          return await this.createTask(message);
        case 'update_task':
          return await this.updateTask(message);
        case 'delete_task':
          return await this.deleteTask(message);
        case 'list_tasks':
          return await this.listTasks(message);
        case 'search_tasks':
          return await this.searchTasks(message);
        case 'create_project':
          return await this.createProject(message);
        case 'manage_project':
          return await this.manageProject(message);
        case 'generate_report':
          return await this.generateReport(message);
        default:
          return this.createResponse(message.id, 'error', null, 'Unknown task action');
      }
    } catch (error) {
      this.log('error', 'Task management error', error);
      return this.createResponse(message.id, 'error', null, error.message);
    }
  }

  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('create') && taskLower.includes('task')) return 'create_task';
    if (taskLower.includes('update') || taskLower.includes('edit')) return 'update_task';
    if (taskLower.includes('delete') || taskLower.includes('remove')) return 'delete_task';
    if (taskLower.includes('list') || taskLower.includes('show tasks')) return 'list_tasks';
    if (taskLower.includes('search') || taskLower.includes('find')) return 'search_tasks';
    if (taskLower.includes('project')) return taskLower.includes('create') ? 'create_project' : 'manage_project';
    if (taskLower.includes('report') || taskLower.includes('summary')) return 'generate_report';
    
    return 'create_task'; // Default
  }

  private async createTask(message: AgentMessage): Promise<AgentResponse> {
    const context = message.payload.context;
    const taskDetails = this.parseTaskDetails(message.payload.task, context);
    
    const task: Task = {
      id: `task_${Date.now()}`,
      title: taskDetails.title,
      description: taskDetails.description,
      status: 'pending',
      priority: taskDetails.priority,
      dueDate: taskDetails.dueDate,
      category: taskDetails.category,
      tags: taskDetails.tags,
      assignedTo: taskDetails.assignedTo,
      projectId: taskDetails.projectId,
      subtasks: [],
      recurrence: taskDetails.recurrence,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tasks.set(task.id, task);
    
    // Handle recurrence
    if (task.recurrence) {
      await this.createRecurringTasks(task);
    }

    this.log('info', 'Task created', { taskId: task.id, title: task.title });

    return this.createResponse(message.id, 'success', {
      task,
      message: `Task "${task.title}" created successfully`,
      taskId: task.id
    });
  }

  private async updateTask(message: AgentMessage): Promise<AgentResponse> {
    const context = message.payload.context;
    const taskId = context.taskId || this.extractTaskId(message.payload.task);
    const updates = this.parseTaskUpdates(message.payload.task, context);

    const task = this.tasks.get(taskId);
    if (!task) {
      return this.createResponse(message.id, 'error', null, 'Task not found');
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        task[key] = updates[key];
      }
    });

    task.updatedAt = new Date();
    
    if (updates.status === 'completed') {
      task.completedAt = new Date();
    }

    this.tasks.set(taskId, task);

    this.log('info', 'Task updated', { taskId, updates });

    return this.createResponse(message.id, 'success', {
      task,
      message: `Task "${task.title}" updated successfully`,
      updatedFields: Object.keys(updates)
    });
  }

  private async listTasks(message: AgentMessage): Promise<AgentResponse> {
    const context = message.payload.context;
    const filters = this.parseFilters(message.payload.task, context);
    
    let tasksArray = Array.from(this.tasks.values());
    
    // Apply filters
    if (filters.status) {
      tasksArray = tasksArray.filter(task => task.status === filters.status);
    }
    if (filters.priority) {
      tasksArray = tasksArray.filter(task => task.priority === filters.priority);
    }
    if (filters.category) {
      tasksArray = tasksArray.filter(task => task.category === filters.category);
    }
    if (filters.assignedTo) {
      tasksArray = tasksArray.filter(task => task.assignedTo === filters.assignedTo);
    }
    if (filters.dueDate) {
      const filterDate = new Date(filters.dueDate);
      tasksArray = tasksArray.filter(task => 
        task.dueDate && task.dueDate <= filterDate
      );
    }

    // Sort tasks
    tasksArray.sort((a, b) => {
      if (filters.sortBy === 'priority') {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      if (filters.sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return b.createdAt.getTime() - a.createdAt.getTime(); // Default: newest first
    });

    return this.createResponse(message.id, 'success', {
      tasks: tasksArray,
      totalCount: tasksArray.length,
      filters,
      summary: this.generateTaskSummary(tasksArray)
    });
  }

  private async searchTasks(message: AgentMessage): Promise<AgentResponse> {
    const context = message.payload.context;
    const searchTerm = context.searchTerm || this.extractSearchTerm(message.payload.task);
    
    const tasks = Array.from(this.tasks.values());
    const results = tasks.filter(task => 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      task.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return this.createResponse(message.id, 'success', {
      searchTerm,
      results,
      totalFound: results.length,
      searchedFields: ['title', 'description', 'tags', 'category']
    });
  }

  private async createProject(message: AgentMessage): Promise<AgentResponse> {
    const context = message.payload.context;
    const projectDetails = this.parseProjectDetails(message.payload.task, context);
    
    const project: Project = {
      id: `project_${Date.now()}`,
      name: projectDetails.name,
      description: projectDetails.description,
      status: 'active',
      members: projectDetails.members || [],
      tasks: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.projects.set(project.id, project);

    return this.createResponse(message.id, 'success', {
      project,
      message: `Project "${project.name}" created successfully`,
      projectId: project.id
    });
  }

  private async generateReport(message: AgentMessage): Promise<AgentResponse> {
    const context = message.payload.context;
    const reportType = context.reportType || 'summary';
    const timeframe = context.timeframe || 'week';
    
    const tasks = Array.from(this.tasks.values());
    const projects = Array.from(this.projects.values());
    
    const report = {
      type: reportType,
      timeframe,
      generatedAt: new Date(),
      summary: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        overdueTasks: tasks.filter(t => 
          t.dueDate && t.dueDate < new Date() && t.status !== 'completed'
        ).length,
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length
      },
      productivityScore: this.calculateProductivityScore(tasks),
      trends: this.analyzeTrends(tasks, timeframe),
      recommendations: this.generateRecommendations(tasks)
    };

    return this.createResponse(message.id, 'success', { report });
  }

  // Helper methods
  private parseTaskDetails(task: string, context: any) {
    return {
      title: context.title || this.extractTitle(task),
      description: context.description || this.extractDescription(task),
      priority: context.priority || this.extractPriority(task) || 'medium',
      dueDate: context.dueDate || this.extractDueDate(task),
      category: context.category || this.extractCategory(task) || 'general',
      tags: context.tags || this.extractTags(task),
      assignedTo: context.assignedTo || this.extractAssignee(task),
      projectId: context.projectId,
      recurrence: context.recurrence || this.extractRecurrence(task)
    };
  }

  private parseTaskUpdates(task: string, context: any) {
    const updates: Partial<Task> = {};
    
    if (context.status || task.includes('complete') || task.includes('done')) {
      updates.status = context.status || (task.includes('complete') || task.includes('done') ? 'completed' : 'in_progress');
    }
    if (context.priority || this.extractPriority(task)) {
      updates.priority = context.priority || this.extractPriority(task);
    }
    if (context.dueDate || this.extractDueDate(task)) {
      updates.dueDate = context.dueDate || this.extractDueDate(task);
    }
    
    return updates;
  }

  private parseFilters(task: string, context: any) {
    return {
      status: context.status || this.extractStatusFilter(task),
      priority: context.priority || this.extractPriorityFilter(task),
      category: context.category || this.extractCategoryFilter(task),
      assignedTo: context.assignedTo,
      dueDate: context.dueDate,
      sortBy: context.sortBy || 'createdAt'
    };
  }

  private parseProjectDetails(task: string, context: any) {
    return {
      name: context.name || this.extractProjectName(task),
      description: context.description,
      members: context.members || []
    };
  }

  private extractTitle(task: string): string {
    // Extract task title from natural language
    const match = task.match(/(?:create|add|new)\s+(?:task\s+)?(?:for\s+)?["']?([^"']+)["']?/i);
    return match ? match[1].trim() : task.split(' ').slice(0, 5).join(' ');
  }

  private extractDescription(task: string): string {
    const match = task.match(/description[:\s]+([^.]+)/i);
    return match ? match[1].trim() : '';
  }

  private extractPriority(task: string): 'low' | 'medium' | 'high' | 'urgent' | null {
    if (task.includes('urgent') || task.includes('asap')) return 'urgent';
    if (task.includes('high priority') || task.includes('important')) return 'high';
    if (task.includes('low priority') || task.includes('when you can')) return 'low';
    if (task.includes('medium') || task.includes('normal')) return 'medium';
    return null;
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
      
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private extractCategory(task: string): string {
    const categories = ['work', 'personal', 'project', 'meeting', 'development', 'marketing', 'admin'];
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

  private extractAssignee(task: string): string | undefined {
    const assignMatch = task.match(/(?:assign|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    return assignMatch ? assignMatch[1] : undefined;
  }

  private extractRecurrence(task: string): RecurrenceRule | undefined {
    if (task.includes('daily')) return { frequency: 'daily', interval: 1 };
    if (task.includes('weekly')) return { frequency: 'weekly', interval: 1 };
    if (task.includes('monthly')) return { frequency: 'monthly', interval: 1 };
    if (task.includes('yearly')) return { frequency: 'yearly', interval: 1 };
    return undefined;
  }

  private extractStatusFilter(task: string): string | undefined {
    if (task.includes('completed')) return 'completed';
    if (task.includes('pending')) return 'pending';
    if (task.includes('in progress')) return 'in_progress';
    return undefined;
  }

  private extractPriorityFilter(task: string): string | undefined {
    return this.extractPriority(task);
  }

  private extractCategoryFilter(task: string): string | undefined {
    return this.extractCategory(task);
  }

  private extractSearchTerm(task: string): string {
    const match = task.match(/(?:search|find)\s+(?:for\s+)?["']?([^"']+)["']?/i);
    return match ? match[1].trim() : '';
  }

  private extractTaskId(task: string): string {
    const match = task.match(/task[_\s]+([a-zA-Z0-9_]+)/i);
    return match ? match[1] : '';
  }

  private extractProjectName(task: string): string {
    const match = task.match(/(?:create|new)\s+project\s+["']?([^"']+)["']?/i);
    return match ? match[1].trim() : 'New Project';
  }

  private async createRecurringTasks(baseTask: Task): Promise<void> {
    if (!baseTask.recurrence) return;
    
    const { frequency, interval, endDate, count } = baseTask.recurrence;
    let currentDate = new Date(baseTask.dueDate || baseTask.createdAt);
    let createdCount = 0;
    const maxCount = count || 52; // Default to 52 instances
    
    while (createdCount < maxCount) {
      if (endDate && currentDate > endDate) break;
      
      // Calculate next occurrence
      switch (frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (interval * 7));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
      }
      
      // Create recurring task
      const recurringTask: Task = {
        ...baseTask,
        id: `${baseTask.id}_recur_${createdCount + 1}`,
        dueDate: new Date(currentDate),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.tasks.set(recurringTask.id, recurringTask);
      createdCount++;
    }
  }

  private generateTaskSummary(tasks: Task[]) {
    return {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
      },
      byPriority: {
        urgent: tasks.filter(t => t.priority === 'urgent').length,
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
      },
      overdue: tasks.filter(t => 
        t.dueDate && t.dueDate < new Date() && t.status !== 'completed'
      ).length
    };
  }

  private calculateProductivityScore(tasks: Task[]): number {
    if (tasks.length === 0) return 0;
    
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => 
      t.dueDate && t.dueDate < new Date() && t.status !== 'completed'
    ).length;
    
    const completionRate = completed / tasks.length;
    const overdueRate = overdue / tasks.length;
    
    return Math.round((completionRate * 100) - (overdueRate * 20));
  }

  private analyzeTrends(tasks: Task[], timeframe: string): any {
    const now = new Date();
    const timeframeDays = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;
    const startDate = new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    
    const recentTasks = tasks.filter(t => t.createdAt >= startDate);
    const completedRecent = recentTasks.filter(t => t.status === 'completed');
    
    return {
      tasksCreated: recentTasks.length,
      tasksCompleted: completedRecent.length,
      completionRate: recentTasks.length > 0 ? completedRecent.length / recentTasks.length : 0,
      averageCompletionTime: this.calculateAverageCompletionTime(completedRecent)
    };
  }

  private calculateAverageCompletionTime(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.completedAt);
    if (completedTasks.length === 0) return 0;
    
    const totalTime = completedTasks.reduce((sum, task) => {
      const completion = task.completedAt!.getTime() - task.createdAt.getTime();
      return sum + completion;
    }, 0);
    
    return totalTime / completedTasks.length / (1000 * 60 * 60 * 24); // Convert to days
  }

  private generateRecommendations(tasks: Task[]): string[] {
    const recommendations = [];
    
    const overdueTasks = tasks.filter(t => 
      t.dueDate && t.dueDate < new Date() && t.status !== 'completed'
    );
    
    if (overdueTasks.length > 0) {
      recommendations.push(`You have ${overdueTasks.length} overdue tasks. Consider prioritizing these.`);
    }
    
    const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');
    if (urgentTasks.length > 3) {
      recommendations.push('You have many urgent tasks. Consider delegating or rescheduling some.');
    }
    
    const completionRate = tasks.filter(t => t.status === 'completed').length / tasks.length;
    if (completionRate < 0.7) {
      recommendations.push('Your task completion rate could be improved. Try breaking large tasks into smaller ones.');
    }
    
    return recommendations;
  }

  public getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  public getProjects(): Project[] {
    return Array.from(this.projects.values());
  }
}

// React Web Application Frontend
export const ChiefOfStaffWebApp = `
import React, { useState, useEffect } from 'react';
import { ChiefOfStaffSystem } from './chief_of_staff_core';

const ChiefOfStaffApp = () => {
  const [system] = useState(() => new ChiefOfStaffSystem());
  const [currentUser, setCurrentUser] = useState('user_123');
  const [conversations, setConversations] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('chat');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentInput.trim() || isProcessing) return;

    setIsProcessing(true);
    
    try {
      const response = await system.processUserRequest(currentInput, currentUser);
      
      setConversations(prev => [...prev, {
        id: Date.now(),
        userInput: currentInput,
        response: response,
        timestamp: new Date()
      }]);
      
      setCurrentInput('');
      
      // Refresh tasks if task-related
      if (response.intent === 'task_management') {
        // In real app, fetch from API
        setTasks(prev => [...prev, response.results?.[0]?.task]);
      }
    } catch (error) {
      console.error('Error processing request:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Chief of Staff
              </h1>
            </div>
            <nav className="flex space-x-8">
              <button
                onClick={() => setView('chat')}
                className={\`\${view === 'chat' ? 'text-blue-600 border-blue-600' : 'text-gray-500'} border-b-2 pb-2\`}
              >
                Chat
              </button>
              <button
                onClick={() => setView('tasks')}
                className={\`\${view === 'tasks' ? 'text-blue-600 border-blue-600' : 'text-gray-500'} border-b-2 pb-2\`}
              >
                Tasks
              </button>
              <button
                onClick={() => setView('calendar')}
                className={\`\${view === 'calendar' ? 'text-blue-600 border-blue-600' : 'text-gray-500'} border-b-2 pb-2\`}
              >
                Calendar
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'chat' && (
          <div className="bg-white rounded-lg shadow">
            {/* Chat History */}
            <div className="h-96 overflow-y-auto p-6 border-b">
              {conversations.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <h3 className="text-lg font-medium">Welcome to Chief of Staff</h3>
                  <p className="mt-2">Ask me to help with tasks, schedule meetings, or manage your productivity.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {conversations.map((conv) => (
                    <div key={conv.id} className="space-y-4">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-600 text-white">
                          {conv.userInput}
                        </div>
                      </div>
                      
                      {/* Assistant Response */}
                      <div className="flex justify-start">
                        <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100">
                          {conv.response.success ? (
                            <div>
                              <p>{conv.response.message}</p>
                              {conv.response.results && (
                                <div className="mt-2 text-sm text-gray-600">
                                  <strong>Results:</strong> {JSON.stringify(conv.response.results, null, 2)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-red-600">Error: {conv.response.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="Ask me anything... (e.g., 'Schedule a meeting with John tomorrow at 2 PM')"
                  className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isProcessing}
                />
                <button
                  type="submit"
                  disabled={isProcessing || !currentInput.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'tasks' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-medium">Task Management</h2>
            </div>
            <div className="p-6">
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No tasks yet. Create one by asking "Create a task for reviewing project proposal"
                </p>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task, index) => (
                    <div key={task?.id || index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{task?.title || 'Untitled Task'}</h3>
                        <span className={\`px-2 py-1 rounded text-sm \${
                          task?.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          task?.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          task?.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }\`}>
                          {task?.priority || 'medium'}
                        </span>
                      </div>
                      {task?.description && (
                        <p className="text-gray-600 mt-2">{task.description}</p>
                      )}
                      {task?.dueDate && (
                        <p className="text-sm text-gray-500 mt-2">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-medium">Calendar Integration</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500 text-center py-8">
                Calendar view will show integrated Google Calendar and Outlook events.
                Try saying "Show my meetings for this week" in the chat.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChiefOfStaffApp;
`;
