const express = require("express");
const router = express.Router();
const { getAllCompany } = require("../controller/companyController");
const {exportBooking, getRevenueBooking, getRevenueService} = require('../controller/companyController');


router.get("/", getAllCompany); //get all company
const express = require('express');
router.get('/revenue/service', getRevenueService);
router.get('/revenue/booking', getRevenueBooking);

module.exports = router;
