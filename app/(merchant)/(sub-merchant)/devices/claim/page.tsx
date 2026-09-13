import { ClaimForm } from './claim-form';

export default function ClaimPage() {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-xl font-semibold">Claim a device</h1>
      <ClaimForm />
    </div>
  );
}
