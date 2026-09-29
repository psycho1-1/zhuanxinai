'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actionLabels,
  type CourseAction,
  type CourseThread,
  type CourseTutorContext,
} from '@/lib/course-tutor-contract';
type Pending = {
  conversationId: string;
  requestId: string;
  revision: number;
  message: string;
  action: CourseAction;
};
async function api<T>(
  path: string,
  signal: AbortSignal,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const r = await fetch('/api/course-tutor/' + path, {
    method,
    signal,
    cache: 'no-store',
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const b = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw Object.assign(new Error(b.error ?? '对话暂时不可用。'), {
      status: r.status,
    });
  return b;
}
export function useCourseTutor(lessonId: string, enabled: boolean) {
  const [context, setContext] = useState<CourseTutorContext | null>(null);
  const [data, setData] = useState<CourseThread | null>(null);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [retry, setRetry] = useState(false),
    [draft, setDraft] = useState('');
  const current = useRef<CourseThread | null>(null),
    pending = useRef<Pending | null>(null),
    lock = useRef(false),
    epoch = useRef(0);
  const requests = useRef(new Set<AbortController>());
  const readEpoch = useRef(0);
  const controller = useCallback(() => {
    const a = new AbortController();
    requests.current.add(a);
    return a;
  }, []);
  const apply = useCallback((d: CourseThread) => {
    current.current = d;
    setData(d);
  }, []);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    const version = epoch.current,
      read = ++readEpoch.current,
      a = controller();
    setLoading(true);
    setError('');
    try {
      const [c, list] = await Promise.all([
        api<{ context: CourseTutorContext }>(
          'context?lessonId=' + encodeURIComponent(lessonId),
          a.signal,
        ),
        api<{ conversations: { id: string }[] }>(
          'conversations?lessonId=' + encodeURIComponent(lessonId),
          a.signal,
        ),
      ]);
      const d = list.conversations[0]
        ? await api<CourseThread>(
            'conversations/' + list.conversations[0].id,
            a.signal,
          )
        : null;
      if (version !== epoch.current || read !== readEpoch.current) return;
      setContext(c.context);
      current.current = d;
      setData(d);
      if (
        pending.current &&
        d?.conversation.id !== pending.current.conversationId
      ) {
        pending.current = null;
        setRetry(false);
      }
      if (
        pending.current &&
        d?.messages.some((m) => m.requestId === pending.current?.requestId)
      ) {
        pending.current = null;
        setRetry(false);
        setDraft('');
      }
    } catch (e) {
      if (
        !a.signal.aborted &&
        version === epoch.current &&
        read === readEpoch.current
      )
        setError(e instanceof Error ? e.message : '连接失败');
    } finally {
      requests.current.delete(a);
      if (version === epoch.current && read === readEpoch.current)
        setLoading(false);
    }
  }, [lessonId, controller]);
  useEffect(() => {
    // CourseTutor is keyed by lessonId: course changes start with fresh React state.
    const activeRequests = requests.current,
      scope = epoch;
    return () => {
      scope.current++;
      for (const a of activeRequests) a.abort();
      activeRequests.clear();
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (enabled)
      void Promise.resolve().then(() => {
        if (active) void refresh();
      });
    return () => {
      active = false;
    };
  }, [enabled, refresh]);
  // Load failures are retried explicitly, not by an unbounded effect loop.
  const waiting = data?.messages.some((m) => m.status === 'pending') ?? false;
  useEffect(() => {
    if (!waiting || !data) return;
    const id = data.conversation.id,
      version = epoch.current;
    const a = controller(),
      activeRequests = requests.current;
    const timer = setTimeout(() => {
      void api<CourseThread>('conversations/' + id, a.signal)
        .then((d) => {
          if (
            version === epoch.current &&
            current.current?.conversation.id === id
          )
            apply(d);
        })
        .catch((e) => {
          if (!a.signal.aborted) setError(e.message);
        })
        .finally(() => requests.current.delete(a));
    }, 1800);
    return () => {
      clearTimeout(timer);
      a.abort();
      activeRequests.delete(a);
    };
  }, [waiting, data, apply, controller]);
  async function send(action: CourseAction = 'ask', isRetry = false) {
    if (lock.current || waiting || !context) return;
    const message = action === 'ask' ? draft.trim() : actionLabels[action];
    if (!isRetry && !message) return;
    lock.current = true;
    readEpoch.current++;
    setLoading(false);
    setBusy(true);
    setError('');
    const version = epoch.current,
      a = controller(),
      timeout = setTimeout(() => a.abort(), 35000);
    try {
      let d = current.current;
      if (!d) {
        d = await api<CourseThread>('conversations', a.signal, 'POST', {
          lessonId,
          resourceId: context.resource.id,
        });
        if (version !== epoch.current) return;
        apply(d);
      }
      const p =
        isRetry && pending.current
          ? pending.current
          : {
              conversationId: d.conversation.id,
              requestId: crypto.randomUUID(),
              revision: d.conversation.revision,
              message,
              action,
            };
      pending.current = p;
      const { conversationId, ...body } = p;
      const result = await api<CourseThread>(
        'conversations/' + conversationId + '/messages',
        a.signal,
        'POST',
        body,
      );
      if (
        version !== epoch.current ||
        current.current?.conversation.id !== conversationId
      )
        return;
      apply(result);
      pending.current = null;
      setRetry(false);
      if (action === 'ask' || isRetry) setDraft('');
    } catch (e) {
      if (version !== epoch.current) return;
      if (
        (e as { status?: number }).status &&
        Number((e as { status?: number }).status) < 500
      ) {
        pending.current = null;
        setRetry(false);
      } else setRetry(!!pending.current);
      setError(
        a.signal.aborted
          ? '等待超时。可安全重试同一条消息，不会重复调用AI。'
          : e instanceof Error
            ? e.message
            : '网络暂时不可用。',
      );
    } finally {
      clearTimeout(timeout);
      requests.current.delete(a);
      if (version === epoch.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function remove() {
    if (lock.current || !current.current) return;
    lock.current = true;
    readEpoch.current++;
    setLoading(false);
    setBusy(true);
    setError('');
    const version = epoch.current,
      a = controller(),
      id = current.current.conversation.id;
    try {
      await api('conversations/' + id, a.signal, 'DELETE');
      if (version !== epoch.current) return;
      current.current = null;
      setData(null);
      pending.current = null;
      setRetry(false);
      setDraft('');
    } catch (e) {
      if (version === epoch.current)
        setError(e instanceof Error ? e.message : '删除失败，请重试。');
    } finally {
      requests.current.delete(a);
      if (version === epoch.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function older() {
    if (!data?.hasMore || loading || lock.current) return;
    const version = epoch.current,
      read = ++readEpoch.current,
      a = controller(),
      id = data.conversation.id;
    setLoading(true);
    try {
      const page = await api<CourseThread>(
        'conversations/' + id + '?before=' + data.messages[0].seq,
        a.signal,
      );
      if (
        version === epoch.current &&
        read === readEpoch.current &&
        current.current?.conversation.id === id
      ) {
        const latest = current.current;
        apply({
          ...latest,
          hasMore: page.hasMore,
          messages: [...page.messages, ...latest.messages],
        });
      }
    } catch (e) {
      if (!a.signal.aborted)
        setError(e instanceof Error ? e.message : '读取失败');
    } finally {
      requests.current.delete(a);
      if (version === epoch.current && read === readEpoch.current)
        setLoading(false);
    }
  }
  return {
    context,
    data,
    loading,
    busy,
    waiting,
    error,
    retry,
    draft,
    setDraft,
    send,
    remove,
    refresh,
    older,
  };
}
