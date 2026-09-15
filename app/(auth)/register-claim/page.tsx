import { RegisterClaimForm } from './register-claim-form';

export default function RegisterClaimPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-semibold">Set up your account</h1>
        <RegisterClaimForm />
      </div>
    </div>
  );
}
