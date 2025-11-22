'use client';

interface StatusDisplayProps {
  status: string;
  message?: string;
}

export default function StatusDisplay({ status, message }: StatusDisplayProps) {
  const getStatusColor = () => {
    switch (status.toLowerCase()) {
      case 'starting':
      case 'processing':
        return 'bg-blue-500 text-blue-50';
      case 'succeeded':
      case 'completed':
        return 'bg-green-500 text-green-50';
      case 'failed':
      case 'canceled':
        return 'bg-red-500 text-red-50';
      default:
        return 'bg-gray-500 text-gray-50';
    }
  };

  const getStatusIcon = () => {
    switch (status.toLowerCase()) {
      case 'starting':
      case 'processing':
        return (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'succeeded':
      case 'completed':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
      case 'canceled':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${getStatusColor()}`}>
      {getStatusIcon()}
      <span className="font-medium capitalize">{status}</span>
      {message && <span className="text-sm opacity-90">- {message}</span>}
    </div>
  );
}

