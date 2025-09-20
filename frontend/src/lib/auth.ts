import { auth } from '@clerk/nextjs/server';

// API communication utilities for authenticated requests
export class AuthAPI {
  private static baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  // Get authentication headers with Clerk token
  static async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const { getToken } = await auth();
      const token = await getToken();
      
      return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  }

  // Make authenticated GET request
  static async get(endpoint: string): Promise<Response> {
    const headers = await this.getAuthHeaders();
    return fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers,
    });
  }

  // Make authenticated POST request
  static async post(endpoint: string, data?: any): Promise<Response> {
    const headers = await this.getAuthHeaders();
    return fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      ...(data && { body: JSON.stringify(data) }),
    });
  }

  // Make authenticated PUT request
  static async put(endpoint: string, data?: any): Promise<Response> {
    const headers = await this.getAuthHeaders();
    return fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers,
      ...(data && { body: JSON.stringify(data) }),
    });
  }

  // Make authenticated DELETE request
  static async delete(endpoint: string): Promise<Response> {
    const headers = await this.getAuthHeaders();
    return fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
  }

  // Get current user from backend
  static async getCurrentUser() {
    try {
      const response = await this.get('/auth/me');
      if (!response.ok) {
        throw new Error('Failed to get current user');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Validate current session
  static async validateSession() {
    try {
      const response = await this.get('/auth/validate');
      if (!response.ok) {
        throw new Error('Failed to validate session');
      }
      return await response.json();
    } catch (error) {
      console.error('Error validating session:', error);
      return { valid: false };
    }
  }

  // Get user permissions
  static async getUserPermissions() {
    try {
      const response = await this.get('/auth/permissions');
      if (!response.ok) {
        throw new Error('Failed to get user permissions');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return { permissions: [] };
    }
  }

  // Logout user (clear session on backend)
  static async logout() {
    try {
      const response = await this.post('/auth/logout');
      return response.ok;
    } catch (error) {
      console.error('Error during logout:', error);
      return false;
    }
  }
}

// Helper function to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { userId } = await auth();
    return !!userId;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

// Helper function to get current user ID
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

// Helper function to get session token
export async function getSessionToken(): Promise<string | null> {
  try {
    const { getToken } = await auth();
    return await getToken();
  } catch (error) {
    console.error('Error getting session token:', error);
    return null;
  }
}