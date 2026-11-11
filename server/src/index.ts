/** @file Server entry point; loads environment variables and starts the API on port 3000. */

import "dotenv/config";
import app from "./app.js";

const PORT = 3000;

console.log("Database connected successfully!");

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
