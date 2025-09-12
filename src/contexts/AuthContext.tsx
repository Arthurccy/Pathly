import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserSettings } from '../types';

interface AuthUser extends User {
  settings?: UserSettings;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('🔐 Starting auth initialization...');
        setIsLoading(true);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Session error:', error);
          if (mounted) {
            setSession(null);
            setUser(null);
            setIsLoading(false);
          }
          return;
        }
        
        console.log('🔐 Initial session check:', session ? 'Found session' : 'No session');
        
        if (mounted) {
          if (session?.user) {
            console.log('👤 User found, loading settings...');
            setSession(session);
            await loadUserWithSettings(session.user);
          } else {
            console.log('👤 No user found, showing auth form');
            setSession(null);
            setUser(null);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    };
    
    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('🔐 Auth state change:', event, session ? 'Session exists' : 'No session');
      
      setIsLoading(true);
      
      try {
        if (event === 'SIGNED_OUT' || !session) {
          console.log('🚪 User signed out, clearing state');
          setSession(null);
          setUser(null);
          setIsLoading(false);
        } else if (session?.user) {
          console.log('👤 User signed in, loading settings');
          setSession(session);
          await loadUserWithSettings(session.user);
        } else {
          console.log('❓ Unknown auth state');
          setSession(null);
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Auth state change error:', error);
        setSession(null);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth subscription');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserWithSettings = async (authUser: User) => {
    if (!authUser) {
      console.log('❌ No auth user provided to loadUserWithSettings');
      setIsLoading(false);
      return;
    }
    
    try {
      console.log('👤 Loading user settings for:', authUser.email);
      
      // Try to load user settings, but don't block if it fails
      let settings = null;
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', authUser.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.warn('⚠️ Could not load user settings:', error.message);
        } else {
          settings = data;
          console.log('⚙️ User settings loaded:', settings ? 'Found' : 'Will create defaults');
        }
      } catch (settingsError) {
        console.warn('⚠️ Settings loading failed, using defaults:', settingsError);
      }
      
      const userWithSettings: AuthUser = {
        ...authUser,
        settings: settings ? {
          fiscalYearStart: settings.fiscal_year_start,
          defaultPeriod: settings.default_period,
          currency: settings.currency,
          dateFormat: settings.date_format,
          theme: settings.theme,
          language: settings.language,
          notifications: settings.notifications,
        } : {
          fiscalYearStart: 1,
          defaultPeriod: 'monthly',
          currency: 'EUR',
          dateFormat: 'dd/MM/yyyy',
          theme: 'auto',
          language: 'fr',
          notifications: {
            budgetAlerts: true,
            recurringReminders: true,
            goalDeadlines: true,
          },
        }
      };

      setUser(userWithSettings);

      // Create default settings if they don't exist
      if (!settings && authUser.id) {
        console.log('📝 Creating default user settings');
        // Don't await this - do it in background
        createDefaultUserSettings(authUser.id).catch(err => {
          console.warn('⚠️ Could not create default settings:', err);
        });
      }
      
      console.log('✅ User loaded successfully');
    } catch (error) {
      console.error('❌ Error loading user with settings:', error);
      // Even if settings fail, set the user so they can use the app
      setUser({
        ...authUser,
        settings: getDefaultSettings()
      } as AuthUser);
      console.log('✅ User loaded with default settings due to error');
    } finally {
      console.log('🏁 Setting loading to false');
      setIsLoading(false);
    }
  };

  const createDefaultUserSettings = async (userId: string) => {
    try {
      console.log('📝 Creating default settings for user:', userId);
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          ...getDefaultSettingsForDB()
        });

      if (error) {
        console.error('❌ Error creating default user settings:', error);
      } else {
        console.log('✅ Default user settings created');
      }
    } catch (error) {
      console.error('❌ Error creating default user settings:', error);
    }
  };

  const getDefaultSettings = (): UserSettings => ({
    fiscalYearStart: 1,
    defaultPeriod: 'monthly',
    currency: 'EUR',
    dateFormat: 'dd/MM/yyyy',
    theme: 'auto',
    language: 'fr',
    notifications: {
      budgetAlerts: true,
      recurringReminders: true,
      goalDeadlines: true,
    },
  });

  const getDefaultSettingsForDB = () => ({
    fiscal_year_start: 1,
    default_period: 'monthly',
    currency: 'EUR',
    date_format: 'dd/MM/yyyy',
    theme: 'auto',
    language: 'fr',
    notifications: {
      budgetAlerts: true,
      recurringReminders: true,
      goalDeadlines: true,
    },
  });

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('🔐 Attempting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        setIsLoading(false);
        return false;
      }

      console.log('✅ Login successful');
      return !!data.user;
    } catch (error) {
      console.error('❌ Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('📝 Attempting registration for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        console.error('❌ Registration error:', error);
        setIsLoading(false);
        return false;
      }

      console.log('✅ Registration successful');
      return !!data.user;
    } catch (error) {
      console.error('❌ Registration error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🚪 Attempting logout');
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Logout error:', error);
        throw error;
      }
      
      console.log('✅ Logout successful');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>): Promise<void> => {
    if (!user) return;

    try {
      const settingsData = {
        fiscal_year_start: newSettings.fiscalYearStart,
        default_period: newSettings.defaultPeriod,
        currency: newSettings.currency,
        date_format: newSettings.dateFormat,
        theme: newSettings.theme,
        language: newSettings.language,
        notifications: newSettings.notifications,
      };

      // Remove undefined values
      const cleanedData = Object.fromEntries(
        Object.entries(settingsData).filter(([_, v]) => v !== undefined)
      );

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...cleanedData,
        });

      if (error) {
        console.error('❌ Error updating user settings:', error);
        throw error;
      }

      // Update local user state
      setUser({
        ...user,
        settings: {
          ...user.settings!,
          ...newSettings,
        },
      });
    } catch (error) {
      console.error('❌ Error updating user settings:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      login,
      register,
      logout,
      updateUserSettings,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};