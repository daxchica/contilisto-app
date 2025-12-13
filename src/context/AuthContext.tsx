// src/context/AuthContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase-config";

/* ============================================================
 * TYPES
 * ============================================================ */
export type UserRole = "user" | "admin" | "master";

export interface AppUser {
  uid: string;
  email: string | null;
  role: UserRole;
  emailVerified: boolean;
  phoneVerified?: boolean;
  planKey?: string;
  planStatus?: string;
  isTestAccount?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
}

/* ============================================================
 * CONTEXT
 * ============================================================ */
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

/* ============================================================
 * PROVIDER
 * ============================================================ */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          // Usuario autenticado pero sin perfil aún
          const defaultUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: "user",
            emailVerified: firebaseUser.emailVerified,
            phoneVerified: false,
            planKey: "free",
            planStatus: "active",
            isTestAccount: false,  
          };

          await setDoc(userRef, defaultUser);
          setUser(defaultUser);
          setLoading(false);
          return;
        }

        const data = snap.data();

        const role: UserRole =
          data.role === "admin" || data.role === "master"
            ? data.role
            : "user";

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role,
          emailVerified: firebaseUser.emailVerified,
          phoneVerified: data.phoneVerified ?? false,
          planKey: data.planKey,
          planStatus: data.planStatus,
          isTestAccount: data.isTestAccount ?? false,
        });
      } catch (error) {
        console.error("AuthContext error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

/* ============================================================
 * HOOK
 * ============================================================ */
export const useAuth = () => useContext(AuthContext);