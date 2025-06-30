const express = require("express");
const connectDB = require("./config/db");
const { json, urlencoded } = require("body-parser");
const morgan = require("morgan");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandles");
const app = express();

// Connect Database
connectDB();

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
    ],
  })
);
app.use(express.json());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(morgan("dev"));

// Phục vụ file tĩnh từ thư mục uploads
app.use("/uploads", express.static("uploads"));

// ACCOUNTS ROUTES
app.use("/api/v1/accounts", require("./routers/accountRouter"));
app.use("/api/v1/customers", require("./routers/customerRouter"));
// COMPANIES ROUTES
app.use("/api/v1/companies", require("./routers/companyRouter"));

// YACHTS ROUTES
app.use("/api/v1/yachts", require("./routers/yachtRouter"));
app.use("/api/v1/yachtImages", require("./routers/yachtImageRouter"));

// ROOMS ROUTES
app.use("/api/v1/rooms", require("./routers/roomRouter"));
// BOOKING ROUTES
app.use("/api/v1/bookings", require("./routers/bookingRouter"));
app.use("/api/v1/payments", require("./routers/paymentRouter"));
app.use("/api/v1/invoices", require("./routers/invoiceRouter"));
//FEEDBACK ROUTES
app.use("/api/v1/feedback", require("./routers/feedbackRouter"));

// SERVICES ROUTES
app.use("/api/v1/services", require("./routers/serviceRouter"));

app.use(errorHandler);
const PORT = process.env.PORT || 9999;

app.listen(PORT, () =>
  console.log(`Server running on port http://localhost:${PORT}`)
);
