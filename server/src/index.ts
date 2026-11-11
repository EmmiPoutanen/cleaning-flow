import "dotenv/config";
import app from "./app.js";

const PORT = 3000;

console.log("Database connected successfully!");

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
