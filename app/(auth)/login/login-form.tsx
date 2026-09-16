'use client';

import { useForm } from '@tanstack/react-form';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInAction } from '@/domains/auth/server/actions';
import { useAction } from '@/hooks/use-action';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function LoginForm() {
  const router = useRouter();
  const login = useAction(signInAction, {
    successMsg: 'Signed in',
    onSuccess: () => router.push('/dashboard'),
  });

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: ({ value }) => login.mutate(value),
  });

  return (
    <motion.div initial="hidden" animate="show" variants={container}>
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage your devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <motion.form
              initial="hidden"
              animate="show"
              variants={container}
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="space-y-4"
            >
              <form.Field name="email">
                {(field) => (
                  <motion.div variants={item} className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </motion.div>
                )}
              </form.Field>
              <form.Field name="password">
                {(field) => (
                  <motion.div variants={item} className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </motion.div>
                )}
              </form.Field>
              <motion.div variants={item}>
                <Button type="submit" disabled={login.isPending} className="w-full">
                  {login.isPending ? 'Signing in…' : 'Log in'}
                </Button>
              </motion.div>
            </motion.form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
