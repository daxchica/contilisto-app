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
 * HELPERS
 * ============================================================ */
function normalizeRole(value: any): UserRole {
  return value === "master" || value === "admin" || value === "user"
    ? value
    : "user";
}

/* ============================================================
 * PROVIDER
 * ============================================================ */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        let resolvedUser: AppUser;

        if (!snap.exists()) {
          resolvedUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: "user",
            emailVerified: firebaseUser.emailVerified,
            phoneVerified: false,
            planKey: "free",
            planStatus: "active",
            isTestAccount: false,  
          };

          await setDoc(userRef, resolvedUser);
        } else {
          const data = snap.data();

          resolvedUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: normalizeRole(data.role),
            emailVerified: firebaseUser.emailVerified,
            phoneVerified: data.phoneVerified ?? false,
            planKey: data.planKey ?? "free",
            planStatus: data.planStatus ?? "active",
            isTestAccount: data.isTestAccount ?? false,
          };
        }

        setUser(resolvedUser);
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