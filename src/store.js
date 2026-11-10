import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { seed } from './data/seed';

const KEY = 'roster-app-v1';
const ROW = 'main';
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && anon ? createClient(url, anon) : null;

export function useStore() {
  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) return JSON.parse(s);
    } catch (e) { /* ignore */ }
    return seed();
  });
  const [ready, setReady] = useState(!supabase);
  const loaded = useRef(!supabase);

  // load from the central database once
  useEffect(() => {
    if (!supabase) return;
    supabase.from('app_state').select('data').eq('id', ROW).maybeSingle()
      .then(({ data, error }) => {
        if (!error && data && data.data) {
          setState(data.data);
        } else if (!error) {
          // first run: save the starting data to the database
          supabase.from('app_state').upsert({ id: ROW, data: seed(), updated_at: new Date().toISOString() });
          setState(seed());
        }
        loaded.current = true;
        setReady(true);
      });
  }, []);

  // save every change (local backup + database)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    if (!supabase || !loaded.current) return;
    const t = setTimeout(() => {
      supabase.from('app_state').upsert({ id: ROW, data: state, updated_at: new Date().toISOString() });
    }, 600);
    return () => clearTimeout(t);
  }, [state]);

  const update = (fn) =>
    setState((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });

  const reset = () => setState(seed());
  return { state, update, reset, ready };
}