'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, Wifi } from 'lucide-react';

export function ConnectionTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    setResults(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      
      // Test basic connection
      const response = await fetch(`${backendUrl}/api/v1/connection-test/connection`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      console.error('Connection test error:', err);
      setError(err.message || 'Failed to connect to backend');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Backend Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Backend URL:</span>
          <Badge variant="outline">
            {process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}
          </Badge>
        </div>

        <Button 
          onClick={testConnection} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing Connection...
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 mr-2" />
              Test Backend Connection
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Connection Failed:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {results && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Connection Successful!</strong> Backend is responding correctly.
            </AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="space-y-2">
            <h3 className="font-semibold text-green-600">Connection Details:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Backend Port:</span>
                <Badge variant="secondary" className="ml-2">{results.backend?.port || 'N/A'}</Badge>
              </div>
              <div>
                <span className="font-medium">Environment:</span>
                <Badge variant="secondary" className="ml-2">{results.backend?.environment || 'N/A'}</Badge>
              </div>
              <div>
                <span className="font-medium">CORS Origin:</span>
                <Badge variant="secondary" className="ml-2">{results.backend?.corsOrigin || 'N/A'}</Badge>
              </div>
              <div>
                <span className="font-medium">Response Time:</span>
                <Badge variant="secondary" className="ml-2">{results.timestamp || 'N/A'}</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-4">
          <p><strong>Note:</strong> This test verifies basic connectivity between frontend and backend without requiring authentication or database connection.</p>
        </div>
      </CardContent>
    </Card>
  );
}