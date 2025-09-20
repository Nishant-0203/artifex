'use client';

import { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useAPIClient } from '@/lib/api-client';
import { AuthHeader } from '@/components/auth/auth-header';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ai-elements/loader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Image, Zap, Clock } from 'lucide-react';
import { ImageGenerationTest } from '@/components/test/image-generation-test';

interface UserData {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  session: {
    isActive: boolean;  
    emailVerified: boolean;
  };
}

interface QuotaData {
  subscription: {
    tier: string;
    status: string;
  };
  quota: {
    textToImage: {
      used: number;
      limit: number;
      remaining: number;
    };
    imageToImage: {
      used: number;
      limit: number;
      remaining: number;
    };
  };
}

export default function DashboardPage() {
  const { user } = useUser();
  const apiClient = useAPIClient();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get user data from backend
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse && userResponse.data) {
        setUserData(userResponse.data);
      }

      // Get quota data from backend  
      const quotaResponse = await apiClient.getQuotaStatus();
      if (quotaResponse && quotaResponse.data) {
        setQuotaData(quotaResponse.data);
      } else {
        // Mock quota data for demo
        setQuotaData({
          subscription: {
            tier: 'free',
            status: 'active',
          },
          quota: {
            textToImage: {
              used: 2,
              limit: 10,
              remaining: 8,
            },
            imageToImage: {
              used: 0,
              limit: 5,
              remaining: 5,
            },
          },
        });
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to connect to backend. Make sure the backend server is running.');
      
      // Set mock data even on error for demo purposes
      setQuotaData({
        subscription: {
          tier: 'free',
          status: 'active',
        },
        quota: {
          textToImage: {
            used: 2,
            limit: 10,
            remaining: 8,
          },
          imageToImage: {
            used: 0,
            limit: 5,
            remaining: 5,
          },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AuthHeader />
        
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                  Welcome back, {user?.firstName || 'User'}! Manage your AI generations and account.
                </p>
              </div>
              <Button onClick={fetchData} disabled={loading} className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert className="mb-6 border-destructive">
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader />
                  <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
                </div>
              </div>
            )}

            {/* Dashboard Content */}
            {!loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* User Info Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-primary-foreground font-semibold text-sm">
                          {user?.firstName?.[0] || 'U'}
                        </span>
                      </div>
                      Account Info
                    </CardTitle>
                    <CardDescription>Your account details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">
                          {userData?.user?.firstName} {userData?.user?.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{userData?.user?.email || user?.emailAddresses?.[0]?.emailAddress}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant={userData?.session?.emailVerified ? 'default' : 'secondary'}>
                          {userData?.session?.emailVerified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Subscription Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Subscription
                    </CardTitle>
                    <CardDescription>Your current plan</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Plan</p>
                        <Badge variant="outline" className="capitalize">
                          {quotaData?.subscription?.tier || 'Free'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant={quotaData?.subscription?.status === 'active' ? 'default' : 'secondary'}>
                          {quotaData?.subscription?.status || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Text-to-Image Quota */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="h-5 w-5" />
                      Text-to-Image
                    </CardTitle>
                    <CardDescription>Generation quota</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Used</p>
                        <p className="font-medium">
                          {quotaData?.quota?.textToImage?.used || 0} / {quotaData?.quota?.textToImage?.limit || 10}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Remaining</p>
                        <p className="font-medium text-primary">
                          {quotaData?.quota?.textToImage?.remaining || 10}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Image-to-Image Quota */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Image-to-Image
                    </CardTitle>
                    <CardDescription>Transformation quota</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Used</p>
                        <p className="font-medium">
                          {quotaData?.quota?.imageToImage?.used || 0} / {quotaData?.quota?.imageToImage?.limit || 5}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Remaining</p>
                        <p className="font-medium text-primary">
                          {quotaData?.quota?.imageToImage?.remaining || 5}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Your recent AI generations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No recent activity. Start generating images to see your history here.
                      </p>
                      <Button className="mt-4" asChild>
                        <a href="/">Start Creating</a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* API Test Component */}
                <div className="md:col-span-3">
                  <ImageGenerationTest />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}