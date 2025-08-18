import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { FinanceProvider } from './hooks/useFinance';
import { AuthProvider, useAuth } from './hooks/useAuth';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const AppContainer: React.FC = () => {
  const { user } = useAuth();
  // By providing a key that changes when the user logs in or out, we force
  // the FinanceProvider and the entire App to re-mount. This is the cleanest
  // way to ensure all state is reset and the correct user's data is loaded.
  return (
    <FinanceProvider key={user ? user.email : 'logged_out'}>
      <App />
    </FinanceProvider>
  );
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <AppContainer />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
