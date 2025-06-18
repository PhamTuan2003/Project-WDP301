const express = require("express");
const router = express.Router();

const { getAllCompany, exportBooking, getRevenueBooking, getRevenueService } = require("../controller/companyController");

router.get("/", getAllCompany); //get all company
router.get('/revenue/service', getRevenueService);
router.get('/revenue/booking', getRevenueBooking);

module.exports = router;
