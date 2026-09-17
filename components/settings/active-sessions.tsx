'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2, Monitor, Shield, Smartphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth-client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';

function parseUserAgent(ua: string | null | undefined) {
  if (!ua) return { browser: 'Unknown', device: 'Desktop' };

  let browser = 'Other browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let device = 'Desktop';
  if (ua.includes('Mobile') || ua.includes('Android')) device = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

  return { browser, device };
}

const sessionsKey = ['auth', 'sessions'] as const;

export function ActiveSessions() {
  const queryClient = useQueryClient();
  const { data: currentSession } = authClient.useSession();
  const { data: sessions, isLoading } = useQuery({
    queryKey: sessionsKey,
    queryFn: async () => {
      const { data } = await authClient.listSessions();
      return data ?? [];
    },
  });

  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const currentToken = currentSession?.session?.token;
  const otherSessions = (sessions ?? []).filter((s) => s.token !== currentToken);

  const revokeSession = async (token: string) => {
    setRevokingToken(token);
    await authClient.revokeSession(
      { token },
      {
        onSuccess: () => {
          toast.success('Session revoked');
          queryClient.invalidateQueries({ queryKey: sessionsKey });
        },
        onError: (ctx) => {
          toast.error(ctx.error.message ?? 'Could not revoke session');
        },
      },
    );
    setRevokingToken(null);
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    await authClient.revokeOtherSessions({
      fetchOptions: {
        onSuccess: () => {
          toast.success('Other sessions revoked');
          queryClient.invalidateQueries({ queryKey: sessionsKey });
        },
        onError: (ctx) => {
          toast.error(ctx.error.message ?? 'Could not revoke sessions');
        },
      },
    });
    setRevokingAll(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4" />
              Active sessions
            </CardTitle>
            <CardDescription>Devices currently signed in to your account.</CardDescription>
          </div>
          {otherSessions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger
                render={(props) => (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={revokingAll}
                    className="shrink-0 gap-1.5 text-xs"
                    {...props}
                  >
                    {revokingAll ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                    Revoke all others
                  </Button>
                )}
              />
              <AlertDialogContent>
                <AlertDialogHeader className="space-y-4">
                  <AlertDialogTitle className="text-lg font-semibold">
                    Revoke all other sessions?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground">
                    This will sign out all other devices and browsers except for the one you are
                    currently using. You will need to sign in again on those devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    render={(props) => (
                      <Button variant="outline" {...props}>
                        Cancel
                      </Button>
                    )}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <Button variant="destructive" onClick={revokeAll}>
                    {revokingAll ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                    Revoke all others
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, index) => {
              const { browser, device } = parseUserAgent(session.userAgent);
              const isCurrent = session.token === currentToken;

              return (
                <div key={session.id}>
                  {index > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {device === 'Mobile' ? (
                          <Smartphone className="size-4 text-muted-foreground" />
                        ) : (
                          <Monitor className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{browser}</p>
                          {isCurrent && (
                            <Badge
                              variant="secondary"
                              className="shrink-0 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                            >
                              This session
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {session.ipAddress && (
                            <>
                              <Globe className="size-3" />
                              <span>{session.ipAddress}</span>
                              <span>·</span>
                            </>
                          )}
                          <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeSession(session.token)}
                        disabled={revokingToken === session.token}
                        className="shrink-0 text-xs text-destructive hover:text-destructive"
                      >
                        {revokingToken === session.token ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Trash2 className="size-3" />
                        )}
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
