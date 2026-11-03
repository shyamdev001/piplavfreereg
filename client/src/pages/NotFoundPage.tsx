import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sunrise px-4 text-center">
      <Logo size={64} variant="mark" />
      <p className="font-mono-brand text-5xl font-extrabold tracking-tight text-primary">404</p>
      <p className="text-lg font-bold text-foreground">Page not found</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or you don't have access to it.
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
