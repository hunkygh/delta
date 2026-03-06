import { supabase } from './supabaseClient.js';

// Auth Service - uses shared Supabase client
export const authService = {
  // Get current authenticated user
  async getCurrentUser() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        return null;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        throw error;
      }
      return user;
    } catch (error) {
      throw error;
    }
  },

  // Get current session
  async getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  // Sign up with email
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/spaces`
      }
    });
    if (error) throw error;
    return data;
  },

  // Sign in with email
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Reset password
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) throw error;
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    const wrappedCallback = (event, session) => {
      try {
        return callback(event, session);
      } catch (error) {
        console.error('Error in auth state change callback:', error);
      }
    };

    return supabase.auth.onAuthStateChange(wrappedCallback);
  },

  // Check if user is authenticated
  async isAuthenticated() {
    const session = await this.getCurrentSession();
    return !!session;
  }
};

export default authService;
