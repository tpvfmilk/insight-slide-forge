
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Toaster } from "@/components/ui/sonner"; // Use our unified toaster component

// Add the Toaster component to the root
createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
  </>
);
