import { createContext, useContext, useEffect, useRef, useState, type AnchorHTMLAttributes } from 'react';
import { parseRoute } from './routes';
const hashRouting = import.meta.env.VITE_PAGES === 'true';
export const pageHref = (to: string) => hashRouting ? `${import.meta.env.BASE_URL}#${to}` : to;
const currentPath = () => hashRouting ? (location.hash.slice(1) || '/') : location.pathname + location.search;
export const Navigation = createContext<(to: string) => void>(() => {});
export function useNavigation(dirty: boolean) {
  const [href, setHref] = useState(currentPath);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const current = useRef(href); current.current = href;
  const confirmLeave = () => !dirtyRef.current || window.confirm('Discard your unsaved changes to this entry?');
  useEffect(() => {
    if (location.pathname === '/' && /^#E[A-Za-z0-9_-]+$/.test(location.hash)) {
      const next = `/entries/${location.hash.slice(1)}`; history.replaceState(null, '', next); setHref(next);
    }
    const pop = () => {
      if (!confirmLeave()) { history.pushState(null, '', pageHref(current.current)); return; }
      setHref(currentPath());
    };
    window.addEventListener('popstate', pop); window.addEventListener('hashchange', pop);
    return () => window.removeEventListener('popstate', pop); window.removeEventListener('hashchange', pop);
  }, []);
  function navigate(to: string, saved = false, replace = false) {
    if (to === current.current) return;
    if (!saved && !confirmLeave()) return;
    if (replace) history.replaceState(null, '', pageHref(to)); else history.pushState(null, '', pageHref(to)); setHref(to); if (!replace) window.scrollTo({ top: 0 });
  }
  return { route: parseRoute(href), navigate };
}
export function Link({ to, children, onClick, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string }) {
  const navigate = useContext(Navigation);
  return <a {...props} href={pageHref(to)} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target) return;
    event.preventDefault(); navigate(to);
  }}>{children}</a>;
}
