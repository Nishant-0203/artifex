import { SignIn } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Artifex AI</h1>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>
        <SignIn 
          appearance={{
            baseTheme: dark,
            elements: {
              formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
              card: 'bg-card border-border shadow-lg',
              headerTitle: 'text-foreground',
              headerSubtitle: 'text-muted-foreground',
              socialButtonsBlockButton: 'border-border hover:bg-accent',
              formFieldInput: 'bg-background border-border text-foreground',
              footerActionLink: 'text-primary hover:text-primary/80',
            },
            variables: {
              colorPrimary: 'hsl(var(--primary))',
              colorBackground: 'hsl(var(--background))',
              colorInputBackground: 'hsl(var(--background))',
              colorInputText: 'hsl(var(--foreground))',
            }
          }}
          signUpUrl="/sign-up"
          redirectUrl="/"
        />
      </div>
    </div>
  );
}