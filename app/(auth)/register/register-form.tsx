'use client';

import { useForm } from '@tanstack/react-form';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpAction } from '@/domains/auth/server/actions';
import { useAction } from '@/hooks/use-action';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function RegisterForm() {
  const router = useRouter();
  const signUp = useAction(signUpAction, {
    successMsg: 'Account created',
    onSuccess: () => router.push('/dashboard'),
  });

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', businessName: '', phone: '' },
    onSubmit: ({ value }) =>
      signUp.mutate({
        name: value.name,
        email: value.email,
        password: value.password,
        businessName: value.businessName,
        phone: value.phone,
      }),
  });

  return (
    <motion.div initial="hidden" animate="show" variants={container}>
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Register</CardTitle>
            <CardDescription>Create a merchant account to manage devices.</CardDescription>
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
              <form.Field name="name">
                {(field) => (
                  <motion.div variants={item} className="space-y-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </motion.div>
                )}
              </form.Field>
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
                      minLength={8}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </motion.div>
                )}
              </form.Field>
              <form.Field name="businessName">
                {(field) => (
                  <motion.div variants={item} className="space-y-2">
                    <Label htmlFor="businessName">Business name</Label>
                    <Input
                      id="businessName"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </motion.div>
                )}
              </form.Field>
              <form.Field name="phone">
                {(field) => (
                  <motion.div variants={item} className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </motion.div>
                )}
              </form.Field>
              <motion.div variants={item}>
                <Button type="submit" disabled={signUp.isPending} className="w-full">
                  {signUp.isPending ? 'Creating account…' : 'Register'}
                </Button>
              </motion.div>
            </motion.form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
