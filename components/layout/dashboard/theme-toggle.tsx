'use client';

import { cn } from 'cn';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useRef } from 'react';

function nextTheme(current: string): 'light' | 'dark' {
  return current === 'dark' ? 'light' : 'dark';
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isLight = resolvedTheme === 'light';

  const handleClick = useCallback(() => {
    const newTheme = nextTheme(resolvedTheme ?? 'light');

    if (!document.startViewTransition) {
      setTheme(newTheme);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    document.documentElement.style.setProperty('--vta-x', `${x}px`);
    document.documentElement.style.setProperty('--vta-y', `${y}px`);
    document.documentElement.style.setProperty('--vta-r', `${maxRadius}px`);

    document.startViewTransition(() => {
      setTheme(newTheme);
    });
  }, [resolvedTheme, setTheme]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      className={cn(
        'relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isLight ? 'border-input bg-muted' : 'border-input bg-muted/60',
      )}
      aria-label={`Theme: ${resolvedTheme}. Click to switch to ${nextTheme(resolvedTheme ?? 'light')}.`}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-1.75 text-xs">
        <Sun
          className={cn(
            'size-3 transition-all',
            isLight ? 'text-foreground opacity-100' : 'text-foreground/30 opacity-40',
          )}
        />
        <Moon
          className={cn(
            'size-3 transition-all',
            isLight ? 'text-foreground/30 opacity-40' : 'text-foreground opacity-100',
          )}
        />
      </span>

      <span
        className={cn(
          'relative z-10 flex size-5 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border transition-all duration-200',
          isLight ? 'translate-x-1' : 'translate-x-8',
        )}
      >
        <Sun
          className={cn(
            'absolute size-3 transition-all',
            isLight ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
        <Moon
          className={cn(
            'absolute size-3 transition-all',
            isLight ? 'scale-50 opacity-0' : 'scale-100 opacity-100',
          )}
        />
      </span>
    </button>
  );
}
