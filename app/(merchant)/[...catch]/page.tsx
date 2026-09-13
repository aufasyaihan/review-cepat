import { notFound } from 'next/navigation';

/** Global catch-all: any unmatched path renders the 404 experience. */
export default function CatchAll() {
  notFound();
}
