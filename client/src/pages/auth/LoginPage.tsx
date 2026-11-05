import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { homePathFor } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Logo } from '@/components/brand/Logo';
import { getErrorMessage } from '@/lib/axios';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  React.useEffect(() => {
    if (!isLoading && user) {
      navigate(homePathFor(user.role), { replace: true });
    }
  }, [user, isLoading, navigate]);

  const onSubmit = async (values: LoginForm) => {
    setSubmitting(true);
    try {
      const loggedInUser = await login(values.email, values.password);
      navigate(homePathFor(loggedInUser.role), { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid email or password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sunrise px-4 py-10">
      {/* Ambient brand glow - decorative, kept behind the content and out of the tab order */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-float-slow rounded-full bg-accent/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 animate-float-slow rounded-full bg-primary/20 blur-3xl"
        style={{ animationDelay: '2s' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="mb-9 flex flex-col items-center text-center">
          <Logo size={92} variant="mark" elevated className="mb-5" />
          <h1 className="text-2xl font-extrabold uppercase tracking-[0.05em] text-foreground">The Solar Coop</h1>
          <p className="mt-1.5 text-sm font-medium text-muted-foreground">Piplav Village Solar Registration</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-3xl border border-border/60 bg-card/90 p-7 shadow-warm-lg backdrop-blur-sm"
        >
          <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@solarcoop.dev"
              {...register('email')}
            />
          </FormField>

          <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-12"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </FormField>

          <Button type="submit" className="group w-full" size="lg" loading={submitting}>
            {!submitting && (
              <>
                Sign in
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-success" />
          Contact your administrator if you've forgotten your password.
        </p>
      </motion.div>
    </div>
  );
}
