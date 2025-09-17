// api/index.ts

import express from "express";
import bodyParser from "body-parser";
import gptRoute from "./gpt";

const app = express();
const PORT = 3001;

app.use(bodyParser.json());
app.use("/api", gptRoute);

app.listen(PORT, () => {
  console.log(`✅ API server running at http://localhost:${PORT}`);
});