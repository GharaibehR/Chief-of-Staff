import { useState } from 'react';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export default function Home() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message, 
          userId: 'demo-user' 
        }),
      });
      
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse('Error: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🤖 Chief of Staff AI
          </h1>
          <p className="text-xl text-gray-600">
            Your AI-powered productivity assistant
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ask your AI assistant:
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Create a task for reviewing the budget"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Send Message'}
            </button>
          </form>
          
          {response && (
            <div className="bg-gray-100 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Response:</h3>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto">
                {response}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
