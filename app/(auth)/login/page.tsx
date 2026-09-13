import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-xl font-semibold">Log in</h1>
      <LoginForm />
    </div>
  );
}
