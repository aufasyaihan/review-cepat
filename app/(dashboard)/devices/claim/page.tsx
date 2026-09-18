import { ClaimForm } from './claim-form';

export default function ClaimDevicePage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center gap-4 py-8">
      <h1 className="text-2xl font-semibold">Claim a device</h1>
      <p className="text-sm text-muted-foreground">
        Enter the one-time claim code that came with your device to link it to your account.
      </p>
      <ClaimForm />
    </div>
  );
}
