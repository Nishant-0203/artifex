import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId, getToken } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the token for backend API calls
    const token = await getToken();
    
    // Test backend health
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const healthResponse = await fetch(`${backendUrl.replace('/api/v1', '')}/health`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!healthResponse.ok) {
      return NextResponse.json(
        { 
          error: 'Backend connection failed',
          status: healthResponse.status,
          backend: backendUrl
        },
        { status: 500 }
      );
    }

    const healthData = await healthResponse.json();

    // Try to get user data from backend
    let userData = null;
    try {
      const userResponse = await fetch(`${backendUrl}/auth/me`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (userResponse.ok) {
        userData = await userResponse.json();
      }
    } catch (error) {
      console.warn('Could not fetch user data from backend:', error);
    }

    return NextResponse.json({
      success: true,
      userId,
      hasToken: !!token,
      backend: {
        url: backendUrl,
        health: healthData,
        connected: true,
      },
      userData: userData?.data || null,
    });

  } catch (error) {
    console.error('API test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}