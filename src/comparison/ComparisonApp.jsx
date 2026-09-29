import React, { useEffect, useRef, useState } from "react";
import { RouterProvider, useRouter } from "../context/RouterContext";
import Home from "./Home";
import Facilities from "./Facilities";
import FacilityDetail from "./FacilityDetail";
import "./comparison.css";

function ComparisonScreens() {
  const { currentPath } = useRouter();
  const [notice, setNotice] = useState(false);
  const timeout = useRef();
  const path = currentPath.replace(/\/$/, "") || "/";
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setNotice(false);
    document.title = `${path === "/" ? "Home" : path === "/facilities" ? "Venues" : "Facility Detail"} · Turf & Taste Comparison`;
  }, [path]);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const onNotice = () => {
    setNotice(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setNotice(false), 4000);
  };
  return (
    <div className="comparison-app">
      {path === "/" ? (
        <Home onNotice={onNotice} />
      ) : path === "/facilities" ? (
        <Facilities onNotice={onNotice} />
      ) : path === "/facilities/detail" ? (
        <FacilityDetail onNotice={onNotice} />
      ) : (
        <main className="empty-state">
          <h1>Outside this comparison</h1>
          <a href="/">Back to Home</a>
        </main>
      )}
      {notice && (
        <div className="scope-notice" role="status">
          Outside this three-screen comparison.
          <button aria-label="Dismiss message" onClick={() => setNotice(false)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
export default function ComparisonApp() {
  return (
    <RouterProvider>
      <ComparisonScreens />
    </RouterProvider>
  );
}
