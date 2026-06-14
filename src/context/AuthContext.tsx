// src/context/AuthContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, signOut, reload } from "firebase/auth";
import { auth } from "@/firebase-config";
import { ensureUserDocument, getUser, AppUser } from "@/services/userService";

/* ============================================================
 * CONTEXT TYPES
 * ============================================================ */

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshEmailVerified: () => Promise<void>;
}

/* ============================================================
 * CONTEXT
 * ============================================================ */

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshEmailVerified: async () => {},
});

/* ============================================================
 * PROVIDER
 * ============================================================ */

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // Re-reads Firebase Auth token so emailVerified reflects the latest state
  const refreshEmailVerified = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    await reload(firebaseUser);
    setUser((prev) =>
      prev ? { ...prev, emailVerified: firebaseUser.emailVerified } : null
    );
  };

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      setLoading(true);

      try {
        if (!firebaseUser) {
          setUser(null);
          return;
        }

        // Ensure Firestore user document exists
        await ensureUserDocument(firebaseUser);

        const dbUser = await getUser(firebaseUser.uid);

        if (isMounted) {
          // Always trust Firebase Auth for emailVerified (Firestore can lag)
          setUser(dbUser ? { ...dbUser, emailVerified: firebaseUser.emailVerified } : null);
        }
      } catch (error) {
        console.error("AuthContext error:", error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshEmailVerified }}>
      {children}
    </AuthContext.Provider>
  );
};

/* ============================================================
 * HOOK
 * ============================================================ */

export const useAuth = () => useContext(AuthContext);


export type UserRole = "owner" | "master" | "admin" | "user" | "accountant" | "assistant" | "viewer";