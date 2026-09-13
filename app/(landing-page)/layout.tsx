/** Public landing-page group layout — structure only, no data fetching. */
export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4">{children}</div>;
}
