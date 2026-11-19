import React from "react";
import { createRoot } from "react-dom/client";
import DemoApp from "./DemoApp";
import { installDemoApiMock } from "./demoApi";
import "./styles.css";

installDemoApiMock();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DemoApp />
  </React.StrictMode>,
);
