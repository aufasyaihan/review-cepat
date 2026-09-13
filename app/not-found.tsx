export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="mt-6 inline-block rounded bg-primary px-4 py-2 text-primary-foreground"
      >
        Back home
      </a>
    </div>
  );
}
