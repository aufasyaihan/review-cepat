import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-semibold">Log in</h1>
        <LoginForm />
      </div>
    </div>
  );
}
