import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const {
      prompt,
      type = 'text-to-image',
      style = 'realistic',
      quality = 'high',
      dimensions = { width: 1024, height: 1024 },
    }: {
      prompt: string;
      type?: string;
      style?: string;
      quality?: string;
      dimensions?: { width: number; height: number };
    } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Get the authentication token
    const token = await getToken();
    
    // Get the backend URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

    // Forward the request to your backend server
    const backendResponse = await fetch(`${backendUrl}/generate/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt,
        style,
        quality,
        dimensions,
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(
        { 
          error: errorData.message || 'Generation failed',
          status: backendResponse.status 
        },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();

    // Return the response from your backend
    return NextResponse.json(result);

  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}