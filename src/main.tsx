// MUST stay first: installs the in-app "backend" before any component fetches /api/...
import './services/embeddedBackend';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
