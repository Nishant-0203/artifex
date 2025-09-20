'use client';

import { useState } from 'react';
import { useAPIClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader } from '@/components/ai-elements/loader';
import { Image as ImageIcon, Wand2 } from 'lucide-react';

export function ImageGenerationTest() {
  const apiClient = useAPIClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testTextToImage = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await apiClient.generateTextToImage({
        prompt: 'A beautiful sunset over mountains',
        style: 'realistic',
        quality: 'high',
        dimensions: {
          width: 1024,
          height: 1024,
        },
      });

      setResult(result);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Test Image Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testTextToImage} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader />
              <span className="ml-2">Generating...</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-2" />
              Generate Test Image
            </>
          )}
        </Button>

        {error && (
          <Alert className="border-destructive">
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-2">
            <h3 className="font-semibold text-green-600">Generation Successful!</h3>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}