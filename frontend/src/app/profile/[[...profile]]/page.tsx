import { UserProfile } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Profile Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences</p>
          </div>
          <UserProfile 
            appearance={{
              baseTheme: dark,
              elements: {
                card: 'bg-card border-border shadow-lg',
                navbar: 'bg-card border-border',
                navbarButton: 'text-foreground hover:bg-accent',
                navbarButtonIcon: 'text-muted-foreground',
                headerTitle: 'text-foreground',
                headerSubtitle: 'text-muted-foreground',
                formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
                formFieldInput: 'bg-background border-border text-foreground',
                badge: 'bg-primary/10 text-primary',
              },
              variables: {
                colorPrimary: 'hsl(var(--primary))',
                colorBackground: 'hsl(var(--background))',
                colorInputBackground: 'hsl(var(--background))',
                colorInputText: 'hsl(var(--foreground))',
              }
            }}
            path="/profile"
            routing="path"
          />
        </div>
      </div>
    </div>
  );
}