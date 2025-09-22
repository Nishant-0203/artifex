import { ConnectionTest } from '@/components/test/connection-test';

export default function TestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Artifex Connection Test</h1>
          <p className="text-muted-foreground">
            Test the connection between frontend and backend
          </p>
        </div>
        
        <div className="flex justify-center">
          <ConnectionTest />
        </div>

        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Setup Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium">Frontend</h3>
              <p className="text-sm text-muted-foreground">
                Running on {typeof window !== 'undefined' ? window.location.origin : 'Unknown'}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium">Backend</h3>
              <p className="text-sm text-muted-foreground">
                Expected on {process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}
              </p>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>
              If the connection test fails, make sure the backend is running with{' '}
              <code className="bg-muted px-1 py-0.5 rounded">npm run dev</code> in the backend directory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}