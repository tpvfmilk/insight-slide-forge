
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Toaster } from "sonner"; // Import Sonner Toaster directly

// Add the Toaster component to the root
createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
  </>
);
