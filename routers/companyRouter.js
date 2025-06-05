const express = require('express');
const {exportBooking, getRevenueBooking, getRevenueService} = require('../controller/companyController');
const router = express.Router();

router.get('/revenue/service', getRevenueService);
router.get('/revenue/booking', getRevenueBooking);

module.exports = router;