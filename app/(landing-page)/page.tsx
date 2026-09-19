import { BarChart3, Link2, MessageSquareText, ScanLine, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GridBackground } from '@/components/layout/grid-background';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'ReviewCepat — Turn every tap and scan into a review',
  description:
    'Give customers an NFC tag or QR code and they leave a Google review in seconds. ReviewCepat tracks every scan so you know exactly what is working.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'ReviewCepat — Turn every tap and scan into a review',
    description:
      'Give customers an NFC tag or QR code and they leave a Google review in seconds. ReviewCepat tracks every scan so you know exactly what is working.',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReviewCepat — Turn every tap and scan into a review',
    description: 'Give customers an NFC tag or QR code and they leave a Google review in seconds.',
  },
};

const STEPS = [
  {
    title: 'Place a tag at the counter or table',
    body: 'We ship you an NFC tag or a printed QR code, already linked to your device in ReviewCepat.',
  },
  {
    title: 'A customer taps their phone or scans the code',
    body: 'No app, no typing a URL. Any modern phone opens the link on the first tap or scan.',
  },
  {
    title: 'They land straight on your Google review page',
    body: 'Or a branded link page if you want to point people at more than one place — your choice per device.',
  },
];

const FEATURES = [
  {
    title: 'Tap. Scan. Redirect.',
    body: 'Single-link devices forward customers instantly to Google Reviews or any URL you choose.',
    icon: ScanLine,
  },
  {
    title: 'Linktree-style pages',
    body: 'Multi-link devices open a mobile-first page with your menu, socials, and booking links.',
    icon: Link2,
  },
  {
    title: 'Scan analytics',
    body: 'Totals, daily trends, device breakdowns, browsers, locations, and referrers, all in one dashboard.',
    icon: BarChart3,
  },
  {
    title: 'Google Reviews built in',
    body: 'Search your business on Google Places and attach it as a review destination in seconds.',
    icon: Star,
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: 'Rp 0',
    cadence: '/month',
    tagline: 'Try ReviewCepat with a single location.',
    features: ['1 device', 'Google Reviews redirect', 'Basic scan counts'],
  },
  {
    name: 'Growth',
    price: 'Rp 149rb',
    cadence: '/month',
    tagline: 'For a growing spot with more than one counter.',
    features: ['Up to 5 devices', 'Full scan analytics', 'Branded link pages', 'Email support'],
    highlighted: true,
  },
  {
    name: 'Business',
    price: 'Rp 399rb',
    cadence: '/month',
    tagline: 'For multi-location merchants and franchises.',
    features: ['Unlimited devices', 'Team member access', 'Priority support', 'Custom onboarding'],
  },
];

const TESTIMONIALS = [
  {
    quote:
      'We went from maybe one review a week to three or four a day just by putting a tag next to the register.',
    name: 'Nadia R.',
    role: 'Owner, Kopi Selasar',
  },
  {
    quote:
      'The analytics told us our takeaway counter was scanned way more than the dine-in tables, so we added a second tag there.',
    name: 'Firman A.',
    role: 'Manager, Warung Betawi Nikmat',
  },
  {
    quote: 'Setup took less time than making the coffee I was drinking while I did it.',
    name: 'Clara T.',
    role: 'Owner, Sudut Rasa Bakery',
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden py-20 text-center sm:py-28">
        <GridBackground />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            NFC tags and QR codes, configured in minutes
          </span>
          <h1 className="font-heading text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            Turn every tap and scan into your next review
          </h1>
          <p className="mx-auto max-w-lg text-lg text-muted-foreground">
            ReviewCepat puts a review link one tap or scan away from your customer, then shows you
            exactly how many of them took it.
          </p>
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Button render={<Link href="/login" />} nativeButton={false} size="lg">
            View dashboard
          </Button>
          <Button
            render={<Link href="mailto:hello@reviewcepat.com" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            Talk to us about a device
          </Button>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 pb-20">
        <h2 className="font-heading text-2xl font-semibold">How it works</h2>
        <ol className="relative mt-8 grid gap-8 sm:grid-cols-3">
          <div
            aria-hidden
            className="absolute top-5 right-0 left-0 hidden h-px bg-linear-to-r from-primary/40 via-primary/10 to-transparent sm:block"
          />
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex flex-col gap-2">
              <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-background font-heading text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <feature.icon className="size-5 text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-medium">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="scroll-mt-20 pb-20">
        <h2 className="font-heading text-2xl font-semibold">Pricing</h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Start free with one device. Upgrade when you're ready to cover the whole counter.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-xl p-6 ring-1 ${
                plan.highlighted ? 'bg-primary/5 ring-2 ring-primary' : 'bg-card ring-foreground/10'
              }`}
            >
              <h3 className="font-medium">{plan.name}</h3>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-heading text-3xl font-semibold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.cadence}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.tagline}</p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                render={<Link href="mailto:hello@reviewcepat.com" />}
                nativeButton={false}
                variant={plan.highlighted ? 'default' : 'outline'}
                className="mt-6"
              >
                Get {plan.name}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-20">
        <h2 className="font-heading text-2xl font-semibold">Merchants already scanning</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex flex-col justify-between rounded-xl bg-card p-5 ring-1 ring-foreground/10"
            >
              <MessageSquareText aria-hidden className="size-5 text-primary/60" />
              <blockquote className="mt-4 flex-1 text-sm text-foreground">
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{testimonial.name}</span> ·{' '}
                {testimonial.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mb-20 rounded-2xl bg-primary/5 px-6 py-14 text-center ring-1 ring-primary/10">
        <h2 className="font-heading text-2xl font-semibold">
          Ready to put your reviews on autopilot?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Devices are set up for you and ready to claim as soon as they arrive — reach out and we'll
          get one on its way.
        </p>
        <Button
          render={<Link href="mailto:hello@reviewcepat.com" />}
          nativeButton={false}
          size="lg"
          className="mt-6"
        >
          Talk to us about a device
        </Button>
      </section>

      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-8 py-14 sm:grid-cols-3">
          <div>
            <span className="text-lg font-semibold">
              Review<span className="text-primary">Cepat</span>
            </span>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              NFC and QR devices that turn a tap or a scan into a customer review.
            </p>
          </div>
          <div className="text-sm">
            <h3 className="font-medium">Product</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <a href="#how-it-works" className="hover:text-foreground">
                  How it works
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground">
                  Pricing
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground">
                  Merchant login
                </Link>
              </li>
            </ul>
          </div>
          <div className="text-sm">
            <h3 className="font-medium">Company</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <a href="mailto:hello@reviewcepat.com" className="hover:text-foreground">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t py-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ReviewCepat. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
