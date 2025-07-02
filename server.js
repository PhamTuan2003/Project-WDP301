const express = require("express");
const connectDB = require("./config/db");
const { json, urlencoded } = require("body-parser");
const morgan = require("morgan");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandles");
const router = require("./routers/index");

const app = express();

// Connect Database
connectDB();

// Middleware

// Phục vụ file tĩnh từ thư mục uploads
app.use("/uploads", express.static("uploads"));

// Phục vụ file tĩnh từ thư mục uploads
app.use("/uploads", express.static("uploads"));

// ACCOUNTS ROUTES
app.use("/api/v1/accounts", require("./routers/accountRouter"));
app.use("/api/v1/customers", require("./routers/customerRouter"));
app.use("/api/v1/companies", require("./routers/companyRouter"));
app.use("/api/v1/yachts", require("./routers/yachtRouter"));
app.use("/api/v1/yachtImages", require("./routers/yachtImageRouter"));
app.use("/api/v1/rooms", require("./routers/roomRouter"));
app.use("/api/v1/bookings", require("./routers/bookingRouter"));
app.use("/api/v1/payments", require("./routers/paymentRouter"));
app.use("/api/v1/invoices", require("./routers/invoiceRouter"));
app.use("/api/v1/feedback", require("./routers/feedbackRouter"));
app.use("/api/v1/services", require("./routers/serviceRouter"));
app.use("/api/v1/companies", require("./routers/companyRouter"));
app.use("/admin", require("./routers/adminRouter"));

// Custom router từ file index.js
router(app);

// Error handler (nên đặt ở cuối)
app.use(errorHandler);

const PORT = process.env.PORT || 9999;

app.listen(PORT, () =>
  console.log(`Server running on port http://localhost:${PORT}`)
);
