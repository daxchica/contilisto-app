import { useEffect } from "react";
import { auth } from "../firebase-config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function Register() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
    if (!loading && user) {
        navigate("/dashboard");
    }
    }, [user, loading]);
}