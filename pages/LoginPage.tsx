
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Card from '../components/Card';
import { LogoIcon, UserCircleIcon } from '../components/Icons';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isAuthenticated } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      login(email);
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center items-center gap-3 mb-8">
          <LogoIcon className="h-10 w-10 text-accent" />
          <h1 className="text-3xl font-bold text-text-primary">FinTrack AI</h1>
        </div>
        <Card>
          <h2 className="text-xl font-bold text-center text-text-primary mb-2">Welcome Back</h2>
          <p className="text-sm text-text-secondary text-center mb-6">Sign in to continue to your dashboard.</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password"className="block text-sm font-medium text-text-secondary mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="••••••••"
              />
              <p className="text-xs text-text-secondary text-center mt-2">(Any password will work for this demo)</p>
            </div>

            <button
              type="submit"
              className="w-full bg-accent text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!email || !password}
            >
              Sign In
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-secondary" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-text-secondary">OR</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => login('demo@fintrack.ai')}
            className="w-full flex justify-center items-center gap-3 bg-surface border border-secondary text-text-primary font-semibold py-2.5 rounded-lg hover:bg-primary transition-colors"
          >
            <UserCircleIcon className="w-5 h-5" />
            Continue as Demo User
          </button>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
