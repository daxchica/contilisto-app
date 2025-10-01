export function uidOrThrow(): string {
  const uid = localStorage.getItem("uid");
  if (!uid) throw new Error("Usuario no autenticado");
  return uid;
}