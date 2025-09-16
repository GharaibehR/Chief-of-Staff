import { ChiefOfStaffAgent } from './chief_of_staff_core';

export class ChiefOfStaffSystemIntegrated {
  private chiefOfStaff: ChiefOfStaffAgent;

  constructor() {
    this.chiefOfStaff = new ChiefOfStaffAgent();
  }

  async processUserRequest(userInput: string, userId: string): Promise<any> {
    try {
      const response = await this.chiefOfStaff.processUserRequest(userInput, userId);
      return {
        ...response,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        message: 'I encountered an error processing your request. Please try again.',
        error: errorMessage
      };
    }
  }
}
