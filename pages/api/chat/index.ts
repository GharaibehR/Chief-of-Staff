import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, userId } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // For now, return a simple response
    // The full system integration will be added when deployed
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
