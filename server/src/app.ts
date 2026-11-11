import express from "express";
import cors from "cors";
import customerRoutes from "./routes/customerRoutes.js";
import visitRoutes from "./routes/visitRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/customers", customerRoutes);
app.use("/api/visits", visitRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", message: "Cleaning-Flow API is running!" });
});

export default app;
