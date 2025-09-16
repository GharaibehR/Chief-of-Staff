import { ChiefOfStaffSystem } from './chief_of_staff_core';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export class ChiefOfStaffSystemIntegrated {
  private chiefOfStaff: ChiefOfStaffSystem;

  constructor() {
    this.chiefOfStaff = new ChiefOfStaffSystem();
  }

  async processUserRequest(userInput: string, userId: string): Promise<any> {
    try {
      const response = await this.chiefOfStaff.processUserRequest(userInput, userId);
      return {
        ...response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('System error:', getErrorMessage(error));
      
      return {
        success: false,
        message: 'I encountered an error processing your request. Please try again.',
        error: getErrorMessage(error)
      };
    }
  }

  async getUserDashboard(userId: string) {
    return {
      tasks: {
        total: 0,
        pending: 0,
        completed: 0,
        overdue: 0
      },
      integrations: [],
      activity: {
        totalRequests: 0,
        requestsThisWeek: 0
      }
    };
  }

  async exportUserData(userId: string) {
    return {
      user: { id: userId },
      conversations: [],
      tasks: [],
      integrations: [],
      analytics: []
    };
  }
}
