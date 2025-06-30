const express = require("express");
const router = express.Router();
const serviceController = require("../controller/serviceController");

// Lấy dịch vụ theo yachtId
router.get("/yachts/:yachtId/services", serviceController.getServicesByYacht);

module.exports = router;
