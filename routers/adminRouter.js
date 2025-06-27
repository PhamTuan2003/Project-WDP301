const express = require("express");
const { getDashboardStats } = require("../controller/adminController");

const router = express.Router();

// Route lấy thống kê dashboard
router.get("/stats", getDashboardStats);

module.exports = router;