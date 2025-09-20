'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthTestPage() {
  const { getToken, isLoaded, userId } = useAuth();
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testAuth = async () => {
    setLoading(true);
    try {
      // Test 1: Get token
      const token = await getToken();
      console.log('Token obtained:', token ? 'YES' : 'NO');
      console.log('Token length:', token?.length || 0);
      
      if (!token) {
        setResult('❌ No token obtained from Clerk');
        return;
      }

      // Test 2: Call backend
      const response = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (response.ok) {
        setResult('✅ Authentication successful: ' + JSON.stringify(data, null, 2));
      } else {
        setResult('❌ Authentication failed: ' + JSON.stringify(data, null, 2));
      }

    } catch (error) {
      console.error('Test error:', error);
      setResult('❌ Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p><strong>User ID:</strong> {userId || 'Not authenticated'}</p>
              <p><strong>Loaded:</strong> {isLoaded ? 'Yes' : 'No'}</p>
            </div>
            
            <Button 
              onClick={testAuth} 
              disabled={loading || !userId}
              className="w-full"
            >
              {loading ? 'Testing...' : 'Test Backend Authentication'}
            </Button>

            {result && (
              <div className="mt-4 p-4 bg-gray-100 rounded-md">
                <pre className="whitespace-pre-wrap text-sm">{result}</pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}