import React, { createContext, useContext, useState, useEffect } from 'react';

const RouterContext = createContext({
  currentPath: '/',
  navigate: () => {},
  params: {},
  queryParams: new URLSearchParams()
});

export function RouterProvider({ children }) {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname || '/';
  });

  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setSearch(window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to) => {
    if (to.startsWith('#')) {
      const el = document.querySelector(to);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const [pathname, searchStr] = to.split('?');
    window.history.pushState({}, '', to);
    setCurrentPath(pathname || '/');
    setSearch(searchStr ? `?${searchStr}` : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const queryParams = new URLSearchParams(search);

  return (
    <RouterContext.Provider value={{ currentPath, navigate, queryParams }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

export function Link({ to, children, className = '', onClick, ...rest }) {
  const { navigate } = useRouter();

  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
}
