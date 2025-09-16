import { NextApiRequest, NextApiResponse } from 'next';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, userId } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Simple response for now
    const response = {
      success: true,
      message: `Hello! I received your message: "${message}". I'm your AI Chief of Staff, ready to help with tasks, scheduling, and productivity!`,
      intent: 'general_query',
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}
