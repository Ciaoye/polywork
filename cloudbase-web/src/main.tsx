/// <reference types="vite/client" />

import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import HomeApp from "../../app/HomeApp";
import ArchiveApp from "../../app/ArchiveApp";
import EventApp from "../../app/EventApp";
import "../../app/globals.css";

window.__POLYWORK_API_URL__ = import.meta.env.VITE_POLYWORK_API_URL;
window.__POLYWORK_STATIC_DATA_URL__ = `${import.meta.env.BASE_URL}polywork-history-before-1012.json`;
window.__POLYWORK_BASE_URL__ = import.meta.env.BASE_URL;
window.__POLYWORK_DEFAULT_PARTICIPANT_MODE__ = import.meta.env.VITE_POLYWORK_DEFAULT_PARTICIPANT_MODE === "live" ? "live" : "static";

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = window.location.pathname.replace(/\/$/, "");
  const route = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  useEffect(() => {
    document.title = route === "" ? "多元工作与收入探索 · 大家的回答" : route.startsWith("/host") ? "多元工作与收入探索 · 主持人端" : route === "/archive" ? "多元工作与收入探索 · 历史档案" : "多元工作与收入探索 · 参与者入口";
  }, [route]);
  if (route === "/archive") return <ArchiveApp />;
  if (route === "/host" || route === "/host/1012" || pathname === "/host/1012" || pathname === "/host") return ["localhost", "127.0.0.1"].includes(window.location.hostname) ? <EventApp mode="host" /> : <main className="desktop"><p className="connection-error">主持端只在本机开放，请打开 http://localhost:3000/host/1012/ 。</p></main>;
  if (route === "/join" || route === "/1012") return <EventApp mode="participant" />;
  if (route === "") return <HomeApp />;
  return <EventApp mode="landing" />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
