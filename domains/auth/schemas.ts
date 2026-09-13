import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  businessName: z.string().trim().max(120).optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
