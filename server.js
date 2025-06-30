const express = require("express");
const connectDB = require("./config/db");
const { json, urlencoded } = require("body-parser");
const morgan = require("morgan");
const cors = require("cors");
const app = express();
const router = require('./routers/index')

// Connect Database
connectDB();

// Middleware

// Đặt cors lên trên, trước tất cả các route
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"]
}));
app.use(express.json());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(morgan('dev'));

// ROUTES
app.use("/api/v1/accounts", require("./routers/accountRouter"));
app.use("/api/v1/customers", require("./routers/customerRouter"));
app.use("/api/v1/companies", require("./routers/companyRouter"));
app.use("/api/v1/yachts", require("./routers/yachtRouter"));
app.use("/api/v1/yachtImages", require("./routers/yachtImageRouter"));
app.use("/api/v1/rooms", require("./routers/roomRouter"));
app.use("/api/v1/feedback", require("./routers/feedbackRouter"));
app.use("/admin", require("./routers/adminRouter"));
app.use("/api/v1/account-companies", require("./routers/accountCompanyRouter"));
app.use("/api/v1/count-companies", require("./routers/accountCompanyRouter"));

router(app);
const PORT = process.env.PORT || 9999;

app.listen(PORT, () =>
  console.log(`Server running on port http://localhost:${PORT}`)
);