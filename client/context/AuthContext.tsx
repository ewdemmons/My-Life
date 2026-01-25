import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { initializeDefaultBubbles } from "@/lib/defaultBubbles";
import { activatePendingInvite } from "@/lib/pendingInvites";

const ONBOARDING_KEY = "@mylife_onboarding_complete";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  isNewUser: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboardingFlag: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  const checkOnboardingStatus = useCallback(async (userId: string) => {
    try {
      const key = `${ONBOARDING_KEY}_${userId}`;
      const completed = await AsyncStorage.getItem(key);
      const isComplete = completed === "true";
      setHasCompletedOnboarding(isComplete);
      return isComplete;
    } catch (err) {
      console.warn("Error checking onboarding status:", err);
      return true;
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const key = `${ONBOARDING_KEY}_${session.user.id}`;
      await AsyncStorage.setItem(key, "true");
      setHasCompletedOnboarding(true);
      setIsNewUser(false);
    } catch (err) {
      console.warn("Error saving onboarding status:", err);
    }
  }, [session?.user?.id]);

  const resetOnboardingFlag = useCallback(() => {
    setIsNewUser(false);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("Failed to get session:", error.message);
        }
        setSession(session);

        if (session?.user) {
          await initializeDefaultBubbles(session.user.id);
          await checkOnboardingStatus(session.user.id);
        }
      } catch (err) {
        console.warn("Auth initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setIsLoading(false);

        if (event === "SIGNED_IN" && session?.user) {
          await initializeDefaultBubbles(session.user.id);
          const isComplete = await checkOnboardingStatus(session.user.id);
          
          if (!isComplete) {
            setIsNewUser(true);
          }

          const inviteResult = await activatePendingInvite(
            session.user.id,
            session.user.email || ""
          );

          if (inviteResult.success) {
            const message = inviteResult.count && inviteResult.count > 1
              ? `You now have access to ${inviteResult.count} shared bubbles!`
              : `${inviteResult.senderName} shared "${inviteResult.bubbleName}" with you!`;
            Alert.alert("Welcome!", message);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [checkOnboardingStatus]);

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: data.user.id,
              email: data.user.email,
              created_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

        if (profileError) {
          console.warn("Profile creation failed:", profileError.message);
        }
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        hasCompletedOnboarding,
        isNewUser,
        signUp,
        signIn,
        signOut,
        completeOnboarding,
        resetOnboardingFlag,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
