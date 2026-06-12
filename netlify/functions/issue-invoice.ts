export default async (_req: Request): Promise<Response> => {
  return Response.json({ error: "Not implemented" }, { status: 501 });
};
