'use client';

import { useAuth } from '@clerk/nextjs';

// API client for backend communication
export class APIClient {
  private static baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  // Make a generic request with optional authentication
  private static async makeRequest(
    endpoint: string, 
    options: RequestInit = {},
    requireAuth = false,
    token?: string | null
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add authentication header if required and token is provided
    if (requireAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });
  }

  // Health check endpoint (no auth required)
  static async healthCheck(): Promise<{ status: string; data: any }> {
    const response = await this.makeRequest('/health');
    return response.json();
  }

  // Get authenticated user info
  static async getCurrentUser(token: string): Promise<any> {
    console.log('Making request to /auth/me with token:', token ? 'present' : 'missing');
    const response = await this.makeRequest('/auth/me', {}, true, token);
    console.log('Response status:', response.status);
    return response.json();
  }

  // Get user quota status
  static async getQuotaStatus(token: string): Promise<any> {
    console.log('Making request to /generate/quota with token:', token ? 'present' : 'missing');
    const response = await this.makeRequest('/generate/quota', {}, true, token);
    console.log('Response status:', response.status);
    return response.json();
  }

  // Text-to-image generation
  static async generateTextToImage(
    data: {
      prompt: string;
      style?: string;
      quality?: string;
      dimensions?: { width: number; height: number };
    },
    token: string
  ): Promise<any> {
    const response = await this.makeRequest('/generate/text-to-image', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true, token);
    return response.json();
  }

  // Image-to-image transformation
  static async generateImageToImage(formData: FormData, token: string): Promise<any> {
    const response = await this.makeRequest('/generate/image-to-image', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    }, true, token);
    return response.json();
  }

  // Multi-image composition
  static async generateMultiImage(formData: FormData, token: string): Promise<any> {
    const response = await this.makeRequest('/generate/multi-image', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    }, true, token);
    return response.json();
  }

  // Image refinement
  static async refineImage(formData: FormData, token: string): Promise<any> {
    const response = await this.makeRequest('/generate/refine', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    }, true, token);
    return response.json();
  }

  // Get generation history
  static async getGenerationHistory(page = 1, limit = 20, type?: string, token?: string): Promise<any> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(type && { type }),
    });
    const response = await this.makeRequest(`/generate/history?${params}`, {}, true, token);
    return response.json();
  }
}

// Hook-based API client for use in React components
export function useAPIClient() {
  const { getToken } = useAuth();

  return {
    async healthCheck() {
      return APIClient.healthCheck();
    },

    async getCurrentUser() {
      const token = await getToken();
      console.log('Token from getToken():', token ? 'present' : 'null');
      if (!token) {
        console.error('No authentication token available');
        throw new Error('No authentication token available');
      }
      return APIClient.getCurrentUser(token);
    },

    async getQuotaStatus() {
      const token = await getToken();
      console.log('Token from getToken():', token ? 'present' : 'null');
      if (!token) {
        console.error('No authentication token available');
        throw new Error('No authentication token available');
      }
      return APIClient.getQuotaStatus(token);
    },

    async generateTextToImage(data: {
      prompt: string;
      style?: string;
      quality?: string;
      dimensions?: { width: number; height: number };
    }) {
      const token = await getToken();
      if (!token) throw new Error('No authentication token available');
      return APIClient.generateTextToImage(data, token);
    },

    async generateImageToImage(formData: FormData) {
      const token = await getToken();
      if (!token) throw new Error('No authentication token available');
      return APIClient.generateImageToImage(formData, token);
    },

    async generateMultiImage(formData: FormData) {
      const token = await getToken();
      if (!token) throw new Error('No authentication token available');
      return APIClient.generateMultiImage(formData, token);
    },

    async refineImage(formData: FormData) {
      const token = await getToken();
      if (!token) throw new Error('No authentication token available');
      return APIClient.refineImage(formData, token);
    },

    async getGenerationHistory(page = 1, limit = 20, type?: string) {
      const token = await getToken();
      if (!token) throw new Error('No authentication token available');
      return APIClient.getGenerationHistory(page, limit, type, token);
    },
  };
}