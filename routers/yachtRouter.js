const express = require('express');
const router = express.Router();
const {createYacht, getAllYacht, getAllServices } = require('../controller/yachtController');
const {upload} = require('../utils/configClound')



router.get("/", getAllYacht); // GET /api/v1/yachts
router.get("/services", getAllServices); // GET /api/v1/yachts/services
router.post('/yacht', upload.single('image'), createYacht);


module.exports = router;