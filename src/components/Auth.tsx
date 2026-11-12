import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, CheckCircle, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/authState';

interface AuthProps {
  initialMode?: 'login' | 'register';
  onBack?: () => void;
}

const Auth: React.FC<AuthProps> = ({ initialMode = 'login', onBack }) => {
  const { login, register, isLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');

  const resendConfirmation = async () => {
    setIsResending(true);
    setError('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: pendingVerificationEmail,
        options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setResendSent(true);
    } catch {
      setError("Impossible de renvoyer le lien pour le moment. Patientez puis réessayez.");
    } finally { setIsResending(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!isLogin && !formData.name.trim()) {
      setError('Le nom est requis pour creer un compte');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const ok = await login(formData.email, formData.password);
        if (!ok) {
          setError('E-mail ou mot de passe incorrect');
        }
        return;
      }

      const ok = await register(formData.email, formData.password, formData.name);
      if (ok) {
        setIsLogin(true);
        setResendSent(false);
        setPendingVerificationEmail(formData.email);
        setSuccess("Compte cree. Verifiez votre boite mail avant d'essayer de vous connecter.");
        setFormData({ email: formData.email, password: '', name: '' });
      } else {
        setError("Erreur lors de la creation du compte. Verifiez que l'email n'est pas deja utilise.");
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      if ((err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err))?.includes('confirmer votre email')) {
        setPendingVerificationEmail(formData.email);
        setResendSent(false);
      }
      setError((err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) || "Une erreur s'est produite. Veuillez reessayer.");
    } finally { setIsSubmitting(false); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Verification de la session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-white dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
        )}

        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pathly</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gerez votre budget personnel en toute simplicite
          </p>
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-center space-x-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Vos donnees sont sauvegardees en ligne de facon securisee</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-center">
              {isLogin ? 'Connexion' : 'Creer un compte'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center mt-2">
              {isLogin
                ? 'Connectez-vous a votre compte cloud'
                : "Creez votre compte, puis confirmez votre email pour l'activer"
              }
            </p>
          </div>

          {!isLogin && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-900/20">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-300" />
                <p className="text-sm leading-6 text-blue-900 dark:text-blue-100">
                  Apres creation, vous devrez cliquer sur le lien recu par email avant de pouvoir vous connecter.
                </p>
              </div>
            </div>
          )}

          {success && !isLogin && !pendingVerificationEmail && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="flex items-start space-x-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm leading-6 text-emerald-800 dark:text-emerald-200">{success}</p>
              </div>
            </div>
          )}

          {pendingVerificationEmail && isLogin && (
            <div role="status" className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:bg-blue-950 dark:text-blue-100">
              <h3 className="font-semibold">Vérifiez votre boîte mail</h3>
              <p className="mt-2 text-sm">Un lien de confirmation a été demandé pour <strong>{pendingVerificationEmail}</strong>. Cliquez dessus pour activer votre compte, puis connectez-vous ici. Pensez à vérifier les courriers indésirables.</p>
              <button type="button" onClick={resendConfirmation} disabled={isResending || resendSent} className="mt-3 text-sm underline disabled:opacity-60">
                {resendSent ? 'Lien renvoyé — vérifiez votre boîte mail' : isResending ? 'Envoi en cours…' : 'Renvoyer le lien de confirmation'}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom complet
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Jean Dupont"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="jean@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="********"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Minimum 6 caracteres
              </p>
            </div>

            {error && (
              <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            {success && isLogin && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  <span>Chargement...</span>
                </>
              ) : (
                <span>{isLogin ? 'Se connecter' : 'Creer le compte'}</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
                setPendingVerificationEmail('');
                setFormData({ email: '', password: '', name: '' });
              }}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              {isLogin
                ? "Pas encore de compte ? S'inscrire"
                : 'Deja un compte ? Se connecter'
              }
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Avantages du stockage cloud
            </h4>
            <ul className="text-xs text-blue-600 dark:text-blue-300 space-y-1">
              <li>Synchronisation multi-appareils</li>
              <li>Sauvegarde automatique securisee</li>
              <li>Acces depuis n'importe ou</li>
              <li>Donnees chiffrees et protegees</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
